// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IDataMarketplace } from "../interfaces/IDataMarketplace.sol";
import { IFeeManager } from "../interfaces/IFeeManager.sol";
import { ITreasury } from "../interfaces/ITreasury.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";
import { IOrganizationRegistry } from "../interfaces/IOrganizationRegistry.sol";

/// @title DataMarketplace
/// @notice Marketplace for supply-chain datasets (sensor logs, provenance exports, ESG data). A provider
///         lists a dataset priced in an allowlisted stablecoin with an encrypted-content pointer; buyers
///         purchase time-boxed access, funds settle to the provider net of a protocol fee, and access
///         grants are recorded on-chain for downstream gating.
/// @dev All fund movement uses {SafeERC20} and is `nonReentrant`. The settlement token is validated against
///      the {StablecoinRegistry} and providers against the {OrganizationRegistry} (both optional — the
///      contract degrades gracefully pre-wiring). The protocol fee is computed via the {FeeManager} and
///      banked in the {Treasury}. All peers are resolved through the {AddressBook}.
contract DataMarketplace is ProofChainAccess, ReentrancyGuard, IDataMarketplace {
    using SafeERC20 for IERC20;

    /// @dev FeeManager action id for a dataset access purchase.
    bytes32 private constant FEE_ACTION = keccak256("DATA_ACCESS");

    /// @dev Seconds in a day, used to convert `accessDays` into an expiry timestamp.
    uint64 private constant ONE_DAY = 1 days;

    /// @dev listingId => listing record.
    mapping(bytes32 => Listing) private _listings;

    /// @dev listingId => buyer => access grant.
    mapping(bytes32 => mapping(address => Access)) private _access;

    /// @notice The settlement token is not on the {StablecoinRegistry} allowlist.
    error TokenNotAccepted(address token);
    /// @notice The provider is not a member of any onboarded organization.
    error ProviderNotOnboarded(address provider);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IDataMarketplace
    function list(
        bytes32 listingId,
        address token,
        uint256 price,
        uint32 accessDays,
        bytes32 contentHash,
        string calldata uri
    ) external override {
        _requireNotGloballyPaused();
        if (token == address(0)) revert ZeroAddress();
        if (price == 0) revert ZeroPrice();
        if (_listings[listingId].state != ListingState.None) revert ListingExists(listingId);
        _requireAcceptedToken(token);
        _requireOnboarded(msg.sender);

        _listings[listingId] = Listing({
            listingId: listingId,
            provider: msg.sender,
            token: token,
            price: price,
            accessDays: accessDays,
            contentHash: contentHash,
            uri: uri,
            state: ListingState.Active
        });

        emit Listed(listingId, msg.sender, token, price, accessDays);
    }

    /// @inheritdoc IDataMarketplace
    function updatePrice(bytes32 listingId, uint256 price) external override {
        _requireNotGloballyPaused();
        Listing storage l = _requireProvider(listingId);
        if (price == 0) revert ZeroPrice();

        l.price = price;
        emit PriceUpdated(listingId, price);
    }

    /// @inheritdoc IDataMarketplace
    function setState(bytes32 listingId, ListingState state) external override {
        _requireNotGloballyPaused();
        Listing storage l = _requireProvider(listingId);
        if (state == ListingState.None) revert InvalidState(listingId, ListingState.Active, state);
        // Delisting is terminal — a delisted listing can never be resurrected.
        if (l.state == ListingState.Delisted) revert InvalidState(listingId, ListingState.Active, l.state);

        l.state = state;
        emit ListingStateChanged(listingId, state);
    }

    /// @inheritdoc IDataMarketplace
    function purchase(bytes32 listingId) external override nonReentrant returns (uint64 expiresAt) {
        _requireNotGloballyPaused();
        Listing storage l = _listings[listingId];
        if (l.state == ListingState.None) revert UnknownListing(listingId);
        if (l.state != ListingState.Active) revert InvalidState(listingId, ListingState.Active, l.state);
        if (msg.sender == l.provider) revert SelfPurchase(listingId);

        // Pull the full price from the buyer, measuring the actual received amount so fee-on-transfer
        // tokens can never over-credit the provider.
        IERC20 erc20 = IERC20(l.token);
        uint256 received;
        {
            uint256 balanceBefore = erc20.balanceOf(address(this));
            erc20.safeTransferFrom(msg.sender, address(this), l.price);
            received = erc20.balanceOf(address(this)) - balanceBefore;
        }

        // Compute + bank the protocol fee in the Treasury, then settle the net to the provider.
        uint256 net = received - _bankFee(l.token, received);

        // Grant (or extend) time-boxed access before releasing funds.
        uint64 nowTs = uint64(block.timestamp);
        if (l.accessDays == 0) {
            expiresAt = type(uint64).max; // perpetual access
        } else {
            uint64 base = _access[listingId][msg.sender].expiresAt > nowTs
                ? _access[listingId][msg.sender].expiresAt
                : nowTs;
            expiresAt = base + uint64(l.accessDays) * ONE_DAY;
        }
        _access[listingId][msg.sender] =
            Access({ listingId: listingId, buyer: msg.sender, grantedAt: nowTs, expiresAt: expiresAt });

        if (net > 0) erc20.safeTransfer(l.provider, net);

        emit AccessPurchased(listingId, msg.sender, received, expiresAt);
    }

    /// @inheritdoc IDataMarketplace
    function hasAccess(bytes32 listingId, address buyer) external view override returns (bool) {
        return _access[listingId][buyer].expiresAt > block.timestamp;
    }

    /// @inheritdoc IDataMarketplace
    function listingOf(bytes32 listingId) external view override returns (Listing memory) {
        return _listings[listingId];
    }

    /// @inheritdoc IDataMarketplace
    function accessOf(bytes32 listingId, address buyer) external view override returns (Access memory) {
        return _access[listingId][buyer];
    }

    /// @dev Compute the protocol fee on `amount` and deposit it into the Treasury via a scoped approval
    ///      that is reset to zero. Returns 0 and does nothing when no FeeManager is wired or the fee is 0.
    function _bankFee(address token, uint256 amount) private returns (uint256 fee) {
        address feeManager = _addrOrZero(Keys.FEE_MANAGER);
        if (feeManager == address(0)) return 0;

        fee = IFeeManager(feeManager).feeFor(FEE_ACTION, amount);
        if (fee == 0) return 0;
        if (fee > amount) fee = amount;

        address treasury = _addr(Keys.TREASURY);
        IERC20(token).forceApprove(treasury, fee);
        ITreasury(treasury).deposit(token, fee);
        IERC20(token).forceApprove(treasury, 0);
    }

    /// @dev Load a listing and assert `msg.sender` is its provider.
    function _requireProvider(bytes32 listingId) private view returns (Listing storage l) {
        l = _listings[listingId];
        if (l.state == ListingState.None) revert UnknownListing(listingId);
        if (msg.sender != l.provider) revert NotProvider(listingId);
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAcceptedToken(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }

    /// @dev Require the provider to belong to an onboarded org when the registry is wired.
    function _requireOnboarded(address provider) private view {
        address registry = _addrOrZero(Keys.ORGANIZATION_REGISTRY);
        if (registry != address(0) && IOrganizationRegistry(registry).orgOfMember(provider) == bytes32(0)) {
            revert ProviderNotOnboarded(provider);
        }
    }
}
