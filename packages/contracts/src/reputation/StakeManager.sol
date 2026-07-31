// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IStakeManager } from "../interfaces/IStakeManager.sol";

/// @title StakeManager
/// @notice Generic ERC20 stake accounting reused by bonds, arbiters, and pools.
/// @dev Each account stakes a single token (fixed on first stake). A portion of the stake can be
///      LOCKED by authorised controllers (e.g. arbiter staking, active-deal escrows) so it cannot
///      be withdrawn, and SLASHER_ROLE holders (the {SlashingController}) can seize stake.
///      All fund movement is `nonReentrant` and uses `SafeERC20`; received amounts are measured
///      from balance deltas so fee-on-transfer tokens can never over-credit an account.
contract StakeManager is ProofChainAccess, ReentrancyGuard, IStakeManager {
    using SafeERC20 for IERC20;

    /// @notice Role permitted to lock/unlock stake on behalf of accounts (deal escrows, arbiter mgr).
    bytes32 public constant STAKE_CONTROLLER_ROLE = keccak256("STAKE_CONTROLLER_ROLE");

    /// @notice Total stake credited to each account.
    mapping(address => uint256) private _staked;

    /// @notice Portion of an account's stake locked against withdrawal.
    mapping(address => uint256) private _locked;

    /// @notice The single ERC20 token each account has staked (set on first stake).
    mapping(address => address) private _stakeToken;

    error TokenMismatch(address account, address expected, address provided);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IStakeManager
    function stake(address token, uint256 amount) external override nonReentrant {
        if (amount == 0) revert IStakeManager.ZeroAmount();
        if (token == address(0)) revert ZeroAddress();
        _requireNotGloballyPaused();

        address current = _stakeToken[msg.sender];
        if (current == address(0)) {
            _stakeToken[msg.sender] = token;
        } else if (current != token) {
            revert TokenMismatch(msg.sender, current, token);
        }

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert IStakeManager.ZeroAmount();

        _staked[msg.sender] += received;
        emit Staked(msg.sender, token, received);
    }

    /// @inheritdoc IStakeManager
    function unstake(address token, uint256 amount) external override nonReentrant {
        if (amount == 0) revert IStakeManager.ZeroAmount();
        address current = _stakeToken[msg.sender];
        if (token != current) revert TokenMismatch(msg.sender, current, token);

        uint256 staked = _staked[msg.sender];
        uint256 available = staked - _locked[msg.sender];
        if (amount > available) revert InsufficientUnlocked(msg.sender, amount, available);

        _staked[msg.sender] = staked - amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, token, amount);
    }

    /// @inheritdoc IStakeManager
    /// @dev Locks `amount` of `account`'s unlocked stake. STAKE_CONTROLLER_ROLE only.
    function lock(address account, uint256 amount) external override onlyRole(STAKE_CONTROLLER_ROLE) {
        if (amount == 0) revert IStakeManager.ZeroAmount();
        uint256 available = _staked[account] - _locked[account];
        if (amount > available) revert InsufficientUnlocked(account, amount, available);
        _locked[account] += amount;
        emit Locked(account, amount);
    }

    /// @inheritdoc IStakeManager
    /// @dev Releases `amount` of `account`'s locked stake. STAKE_CONTROLLER_ROLE only.
    function unlock(address account, uint256 amount) external override onlyRole(STAKE_CONTROLLER_ROLE) {
        if (amount == 0) revert IStakeManager.ZeroAmount();
        uint256 locked = _locked[account];
        if (amount > locked) revert InsufficientStake(account, amount, locked);
        _locked[account] = locked - amount;
        emit Unlocked(account, amount);
    }

    /// @inheritdoc IStakeManager
    /// @dev Seizes `amount` of `account`'s stake (locked or not) and sends it to `to`. SLASHER only.
    function slash(address account, uint256 amount, address to)
        external
        override
        nonReentrant
        onlyRole(Roles.SLASHER_ROLE)
    {
        if (amount == 0) revert IStakeManager.ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 staked = _staked[account];
        if (amount > staked) revert InsufficientStake(account, amount, staked);

        // Slashing eats into locked stake first-in-effect: reduce the locked bookkeeping so it
        // never exceeds the remaining total.
        uint256 remaining = staked - amount;
        if (_locked[account] > remaining) {
            _locked[account] = remaining;
        }
        _staked[account] = remaining;

        IERC20(_stakeToken[account]).safeTransfer(to, amount);
        emit StakeSlashed(account, amount, to);
    }

    /// @inheritdoc IStakeManager
    function stakeOf(address account) external view override returns (uint256) {
        return _staked[account];
    }

    /// @inheritdoc IStakeManager
    function lockedOf(address account) external view override returns (uint256) {
        return _locked[account];
    }

    /// @notice Unlocked (withdrawable) stake of `account`.
    function unlockedOf(address account) external view returns (uint256) {
        return _staked[account] - _locked[account];
    }

    /// @notice The ERC20 token `account` has staked (zero if the account never staked).
    function stakeTokenOf(address account) external view returns (address) {
        return _stakeToken[account];
    }
}
