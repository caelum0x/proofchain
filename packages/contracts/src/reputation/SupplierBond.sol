// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { ISupplierBond } from "../interfaces/ISupplierBond.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title SupplierBond
/// @notice Suppliers stake an ERC20 bond that guarantees good behavior and can be locked against
///         active deals or slashed on proven fraud.
/// @dev Accepted bond tokens are gated by the {StablecoinRegistry}. Slashing is performed only by
///      the registered {SlashingController} (resolved through the {AddressBook}). A portion of a
///      bond may be LOCKED by {BOND_LOCKER_ROLE} holders (e.g. an escrow with an open deal) so it
///      cannot be withdrawn while obligations are outstanding. Each supplier bonds a single token.
contract SupplierBond is ProofChainAccess, ReentrancyGuard, ISupplierBond {
    using SafeERC20 for IERC20;

    /// @notice Role permitted to lock/unlock a supplier's bond against outstanding obligations.
    bytes32 public constant BOND_LOCKER_ROLE = keccak256("BOND_LOCKER_ROLE");

    /// @notice Total bond posted by each supplier.
    mapping(address => uint256) private _bond;

    /// @notice Portion of a supplier's bond locked against active obligations.
    mapping(address => uint256) private _locked;

    /// @notice The single ERC20 token each supplier has bonded (set on first deposit).
    mapping(address => address) private _bondToken;

    event BondLocked(address indexed supplier, uint256 amount);
    event BondUnlocked(address indexed supplier, uint256 amount);

    error TokenMismatch(address supplier, address expected, address provided);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc ISupplierBond
    function depositBond(address token, uint256 amount) external override nonReentrant {
        if (amount == 0) revert ISupplierBond.ZeroAmount();
        if (token == address(0)) revert ZeroAddress();
        _requireNotGloballyPaused();

        IStablecoinRegistry registry = IStablecoinRegistry(_addr(Keys.STABLECOIN_REGISTRY));
        if (!registry.isAccepted(token)) revert TokenNotAccepted(token);

        address current = _bondToken[msg.sender];
        if (current == address(0)) {
            _bondToken[msg.sender] = token;
        } else if (current != token) {
            revert TokenMismatch(msg.sender, current, token);
        }

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ISupplierBond.ZeroAmount();

        _bond[msg.sender] += received;
        emit BondDeposited(msg.sender, token, received);
    }

    /// @inheritdoc ISupplierBond
    function withdrawBond(address token, uint256 amount) external override nonReentrant {
        if (amount == 0) revert ISupplierBond.ZeroAmount();
        address current = _bondToken[msg.sender];
        if (token != current) revert TokenMismatch(msg.sender, current, token);

        uint256 bond = _bond[msg.sender];
        uint256 available = bond - _locked[msg.sender];
        if (amount > available) revert InsufficientUnlockedBond(msg.sender, amount, available);

        _bond[msg.sender] = bond - amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit BondWithdrawn(msg.sender, token, amount);
    }

    /// @inheritdoc ISupplierBond
    /// @dev Callable only by the registered {SlashingController}. Seizes bond (locked or not).
    function slashBond(address supplier, uint256 amount, address to) external override nonReentrant {
        if (msg.sender != _addr(Keys.SLASHING_CONTROLLER)) revert NotSlasher(msg.sender);
        if (amount == 0) revert ISupplierBond.ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 bond = _bond[supplier];
        if (amount > bond) revert InsufficientUnlockedBond(supplier, amount, bond);

        uint256 remaining = bond - amount;
        if (_locked[supplier] > remaining) {
            _locked[supplier] = remaining;
        }
        _bond[supplier] = remaining;

        IERC20(_bondToken[supplier]).safeTransfer(to, amount);
        emit BondSlashed(supplier, amount, to);
    }

    /// @notice Lock `amount` of `supplier`'s unlocked bond. BOND_LOCKER_ROLE only.
    function lockBond(address supplier, uint256 amount) external onlyRole(BOND_LOCKER_ROLE) {
        if (amount == 0) revert ISupplierBond.ZeroAmount();
        uint256 available = _bond[supplier] - _locked[supplier];
        if (amount > available) revert InsufficientUnlockedBond(supplier, amount, available);
        _locked[supplier] += amount;
        emit BondLocked(supplier, amount);
    }

    /// @notice Release `amount` of `supplier`'s locked bond. BOND_LOCKER_ROLE only.
    function unlockBond(address supplier, uint256 amount) external onlyRole(BOND_LOCKER_ROLE) {
        if (amount == 0) revert ISupplierBond.ZeroAmount();
        uint256 locked = _locked[supplier];
        if (amount > locked) revert InsufficientUnlockedBond(supplier, amount, locked);
        _locked[supplier] = locked - amount;
        emit BondUnlocked(supplier, amount);
    }

    /// @inheritdoc ISupplierBond
    function bondOf(address supplier) external view override returns (uint256) {
        return _bond[supplier];
    }

    /// @inheritdoc ISupplierBond
    function lockedOf(address supplier) external view override returns (uint256) {
        return _locked[supplier];
    }

    /// @notice Unlocked (withdrawable) bond of `supplier`.
    function unlockedOf(address supplier) external view returns (uint256) {
        return _bond[supplier] - _locked[supplier];
    }

    /// @notice The ERC20 token `supplier` has bonded (zero if never bonded).
    function bondTokenOf(address supplier) external view returns (address) {
        return _bondToken[supplier];
    }
}
