// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IGreenBondIssuer } from "../interfaces/IGreenBondIssuer.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title GreenBondIssuer
/// @notice Issues use-of-proceeds green bonds. An underwriter defines a bond (principal target, fixed
///         coupon in bps, tenor, coupon periods, eligible green category); investors subscribe with an
///         accepted stablecoin; the issuer draws down raised proceeds to eligible green projects,
///         funds coupon pools period by period (claimed pro-rata by principal), and repays principal at
///         maturity for investors to redeem.
/// @dev All fund movement is `nonReentrant`, uses SafeERC20, and snapshots received amounts for
///      fee-on-transfer safety. Three independent value pools share the contract's token balance but
///      never cross-drain: subscriptions (capped by `principalRaised`, drawn only by
///      {allocateProceeds}/{refund}), coupon pools (funded by the issuer, drawn only by
///      {claimCoupon}), and the maturity principal pool (funded by {repayPrincipal}, drawn only by
///      {redeem}). Accepted settlement tokens are validated through the {StablecoinRegistry} when it is
///      wired via the {AddressBook}; peers are never hardcoded.
contract GreenBondIssuer is ProofChainAccess, ReentrancyGuard, IGreenBondIssuer {
    using SafeERC20 for IERC20;

    /// @dev bondId => bond record.
    mapping(bytes32 => Bond) private _bonds;

    /// @dev bondId => investor => holding.
    mapping(bytes32 => mapping(address => Holding)) private _holdings;

    /// @dev bondId => cumulative coupon capital funded across all periods (claimed pro-rata by principal).
    mapping(bytes32 => uint256) private _couponFundedTotal;

    /// @dev bondId => period => already funded (prevents double-funding a coupon period).
    mapping(bytes32 => mapping(uint16 => bool)) private _couponPeriodFunded;

    /// @dev bondId => proceeds already drawn down to green projects (bounded by principalRaised).
    mapping(bytes32 => uint256) private _proceedsAllocated;

    /// @notice Settlement token is not on the {StablecoinRegistry} allowlist.
    error TokenNotAccepted(address token);

    /// @notice Emitted when a subscriber reclaims principal from a cancelled offering.
    event Refunded(bytes32 indexed bondId, address indexed investor, uint256 amount);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE plus the initial UNDERWRITER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.UNDERWRITER_ROLE, admin);
    }

    // --------------------------------------------------------------------- issuance

    /// @inheritdoc IGreenBondIssuer
    function createBond(
        bytes32 bondId,
        address token,
        uint256 principalTarget,
        uint16 couponBps,
        uint32 tenorDays,
        uint32 couponPeriods,
        bytes32 greenCategory
    ) external override onlyRole(Roles.UNDERWRITER_ROLE) {
        _requireNotGloballyPaused();
        if (_bonds[bondId].state != BondState.None) revert BondExists(bondId);
        if (token == address(0) || principalTarget == 0 || tenorDays == 0 || couponPeriods == 0) {
            revert InvalidTerms();
        }
        _requireAccepted(token);

        _bonds[bondId] = Bond({
            bondId: bondId,
            issuer: msg.sender,
            token: token,
            principalTarget: principalTarget,
            principalRaised: 0,
            couponBps: couponBps,
            tenorDays: tenorDays,
            couponPeriods: couponPeriods,
            greenCategory: greenCategory,
            issuedAt: 0,
            maturesAt: 0,
            state: BondState.Offering
        });

        emit BondCreated(bondId, msg.sender, token, principalTarget, couponBps, greenCategory);
    }

    /// @inheritdoc IGreenBondIssuer
    function subscribe(bytes32 bondId, uint256 amount) external override nonReentrant {
        _requireNotGloballyPaused();
        if (amount == 0) revert ZeroAmount();

        Bond storage b = _bonds[bondId];
        _requireState(bondId, b, BondState.Offering);

        uint256 remaining = b.principalTarget - b.principalRaised;
        if (amount > remaining) revert TargetExceeded(bondId, amount, remaining);

        uint256 received = _pull(b.token, msg.sender, amount);
        b.principalRaised += received;
        _holdings[bondId][msg.sender].principal += received;

        emit Subscribed(bondId, msg.sender, received);
    }

    /// @inheritdoc IGreenBondIssuer
    function closeOffering(bytes32 bondId) external override {
        _requireNotGloballyPaused();
        Bond storage b = _bonds[bondId];
        _requireState(bondId, b, BondState.Offering);
        _requireIssuer(bondId, b);
        if (b.principalRaised == 0) revert ZeroAmount();

        b.state = BondState.Active;
        b.issuedAt = uint64(block.timestamp);
        b.maturesAt = uint64(block.timestamp + uint256(b.tenorDays) * 1 days);

        emit OfferingClosed(bondId, b.principalRaised);
    }

    /// @notice Cancel an offering that never activated, unlocking subscriber {refund}s. Issuer only.
    /// @dev Extra to the interface surface so the `Cancelled` state is reachable and subscribers are
    ///      never trapped when a raise fails.
    function cancelBond(bytes32 bondId) external {
        _requireNotGloballyPaused();
        Bond storage b = _bonds[bondId];
        _requireState(bondId, b, BondState.Offering);
        _requireIssuer(bondId, b);
        b.state = BondState.Cancelled;
        emit BondCancelled(bondId);
    }

    /// @notice Reclaim subscribed principal from a cancelled offering. nonReentrant.
    function refund(bytes32 bondId) external nonReentrant returns (uint256 amount) {
        _requireNotGloballyPaused();
        Bond storage b = _bonds[bondId];
        _requireState(bondId, b, BondState.Cancelled);

        Holding storage h = _holdings[bondId][msg.sender];
        amount = h.principal;
        if (amount == 0 || h.redeemed) revert NothingToRedeem(bondId, msg.sender);

        h.redeemed = true;
        IERC20(b.token).safeTransfer(msg.sender, amount);
        emit Refunded(bondId, msg.sender, amount);
    }

    // --------------------------------------------------------------------- coupons & proceeds

    /// @inheritdoc IGreenBondIssuer
    function fundCoupon(bytes32 bondId, uint16 period, uint256 amount) external override nonReentrant {
        _requireNotGloballyPaused();
        if (amount == 0) revert ZeroAmount();

        Bond storage b = _bonds[bondId];
        _requireState(bondId, b, BondState.Active);
        _requireIssuer(bondId, b);
        if (period >= b.couponPeriods) revert InvalidPeriod(bondId, period);
        if (_couponPeriodFunded[bondId][period]) revert CouponPeriodFunded(bondId, period);

        uint256 received = _pull(b.token, msg.sender, amount);
        _couponPeriodFunded[bondId][period] = true;
        _couponFundedTotal[bondId] += received;

        emit CouponFunded(bondId, period, received);
    }

    /// @inheritdoc IGreenBondIssuer
    function claimCoupon(bytes32 bondId) external override nonReentrant returns (uint256 amount) {
        _requireNotGloballyPaused();
        Bond storage b = _bonds[bondId];
        // Coupons remain claimable after the bond matures.
        if (b.state != BondState.Active && b.state != BondState.Matured) {
            revert InvalidState(bondId, BondState.Active, b.state);
        }

        amount = _claimable(bondId, b, msg.sender);
        if (amount == 0) revert NothingToClaim(bondId, msg.sender);

        _holdings[bondId][msg.sender].couponsClaimed += amount;
        IERC20(b.token).safeTransfer(msg.sender, amount);

        emit CouponClaimed(bondId, msg.sender, amount);
    }

    /// @inheritdoc IGreenBondIssuer
    function allocateProceeds(bytes32 bondId, bytes32 projectId, uint256 amount) external override nonReentrant {
        _requireNotGloballyPaused();
        if (amount == 0) revert ZeroAmount();

        Bond storage b = _bonds[bondId];
        _requireState(bondId, b, BondState.Active);
        _requireIssuer(bondId, b);

        uint256 remaining = b.principalRaised - _proceedsAllocated[bondId];
        if (amount > remaining) revert TargetExceeded(bondId, amount, remaining);

        _proceedsAllocated[bondId] += amount;
        IERC20(b.token).safeTransfer(b.issuer, amount);

        emit ProceedsAllocated(bondId, projectId, amount);
    }

    // --------------------------------------------------------------------- maturity

    /// @inheritdoc IGreenBondIssuer
    function repayPrincipal(bytes32 bondId) external override nonReentrant {
        _requireNotGloballyPaused();
        Bond storage b = _bonds[bondId];
        _requireState(bondId, b, BondState.Active);
        _requireIssuer(bondId, b);

        uint256 due = b.principalRaised;
        uint256 received = _pull(b.token, msg.sender, due);
        // Redemptions draw exactly `principalRaised`; a short pull (fee-on-transfer) would strand
        // redeemers, so require the full amount landed.
        if (received < due) revert InvalidTerms();

        b.state = BondState.Matured;
        emit BondMatured(bondId);
    }

    /// @inheritdoc IGreenBondIssuer
    function redeem(bytes32 bondId) external override nonReentrant returns (uint256 principal) {
        _requireNotGloballyPaused();
        Bond storage b = _bonds[bondId];
        _requireState(bondId, b, BondState.Matured);

        Holding storage h = _holdings[bondId][msg.sender];
        principal = h.principal;
        if (principal == 0 || h.redeemed) revert NothingToRedeem(bondId, msg.sender);

        h.redeemed = true;
        IERC20(b.token).safeTransfer(msg.sender, principal);

        emit Redeemed(bondId, msg.sender, principal);
    }

    /// @inheritdoc IGreenBondIssuer
    function markDefaulted(bytes32 bondId) external override {
        _requireNotGloballyPaused();
        if (!hasRole(Roles.UNDERWRITER_ROLE, msg.sender) && !hasRole(Roles.GOVERNOR_ROLE, msg.sender)) {
            revert NotIssuer(bondId);
        }
        Bond storage b = _bonds[bondId];
        _requireState(bondId, b, BondState.Active);
        b.state = BondState.Defaulted;
        emit BondDefaulted(bondId);
    }

    // --------------------------------------------------------------------- views

    /// @inheritdoc IGreenBondIssuer
    function bondOf(bytes32 bondId) external view override returns (Bond memory) {
        if (_bonds[bondId].state == BondState.None) revert UnknownBond(bondId);
        return _bonds[bondId];
    }

    /// @inheritdoc IGreenBondIssuer
    function holdingOf(bytes32 bondId, address investor) external view override returns (Holding memory) {
        return _holdings[bondId][investor];
    }

    /// @notice Coupon amount currently claimable by `investor` for `bondId`.
    function claimableCoupon(bytes32 bondId, address investor) external view returns (uint256) {
        Bond storage b = _bonds[bondId];
        if (b.state == BondState.None) revert UnknownBond(bondId);
        return _claimable(bondId, b, investor);
    }

    /// @notice Total proceeds drawn down to green projects for `bondId`.
    function proceedsAllocated(bytes32 bondId) external view returns (uint256) {
        return _proceedsAllocated[bondId];
    }

    // --------------------------------------------------------------------- internal

    /// @dev Pro-rata coupon entitlement minus what has already been claimed. Entitlement is
    ///      `principal * totalFunded / principalRaised`, exact because each period's pool is shared
    ///      pro-rata by principal and `principalRaised` is fixed once the offering closes.
    function _claimable(bytes32 bondId, Bond storage b, address investor) private view returns (uint256) {
        if (b.principalRaised == 0) return 0;
        Holding storage h = _holdings[bondId][investor];
        uint256 entitlement = (h.principal * _couponFundedTotal[bondId]) / b.principalRaised;
        if (entitlement <= h.couponsClaimed) return 0;
        return entitlement - h.couponsClaimed;
    }

    /// @dev Pull `amount` of `token` from `from`, returning the amount actually received.
    function _pull(address token, address from, uint256 amount) private returns (uint256 received) {
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amount);
        received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }

    /// @dev Require a bond to exist and be in `expected` state.
    function _requireState(bytes32 bondId, Bond storage b, BondState expected) private view {
        if (b.state == BondState.None) revert UnknownBond(bondId);
        if (b.state != expected) revert InvalidState(bondId, expected, b.state);
    }

    /// @dev Require the caller to be the bond's issuer.
    function _requireIssuer(bytes32 bondId, Bond storage b) private view {
        if (msg.sender != b.issuer) revert NotIssuer(bondId);
    }
}
