// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IArbiterStaking } from "../interfaces/IArbiterStaking.sol";
import { IStakeManager } from "../interfaces/IStakeManager.sol";
import { IArbiterCoordination } from "./IArbiterCoordination.sol";

/// @title ArbiterStaking
/// @notice Registry of staked arbiters eligible to resolve disputes in {DisputeArbitration}.
/// @dev Custody is delegated to the shared {StakeManager}: an arbiter first deposits generic stake
///      there, then commits (locks) part of it here to gain arbiter status. Committed stake is held
///      LOCKED in the StakeManager (this contract must hold `STAKE_CONTROLLER_ROLE`), so it cannot
///      be withdrawn while the arbiter is active and remains seizable by the slashing path if they
///      vote maliciously. While an arbiter has unresolved votes their stake is additionally
///      vote-locked and cannot be un-committed. Only the registered {DisputeArbitration} contract
///      may drive the vote-lock / slash reconciliation hooks.
contract ArbiterStaking is ProofChainAccess, IArbiterStaking, IArbiterCoordination {
    /// @notice Minimum committed stake required to be considered an arbiter.
    uint256 private _minStake;

    /// @notice Stake each account has committed (locked in the StakeManager) as an arbiter.
    mapping(address => uint256) private _arbiterStake;

    /// @notice Count of unresolved votes locking each arbiter's committed stake.
    mapping(address => uint256) private _pendingVotes;

    error InsufficientUnlockedStake(uint256 available, uint256 requested);
    error InsufficientArbiterStake(uint256 committed, uint256 requested);
    error NotDisputeModule(address caller);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    /// @param minStake_ Initial minimum committed stake to qualify as an arbiter.
    constructor(address addressBook_, address admin, uint256 minStake_) ProofChainAccess(addressBook_, admin) {
        _minStake = minStake_;
        emit MinStakeUpdated(minStake_);
    }

    /// @notice Update the minimum arbiter stake. Admin only.
    /// @dev Does not retroactively evict arbiters below the new floor; {isArbiter} simply reflects it.
    function setMinStake(uint256 newMinStake) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _minStake = newMinStake;
        emit MinStakeUpdated(newMinStake);
    }

    /// @inheritdoc IArbiterStaking
    /// @dev Commits `amount` of the caller's UNLOCKED {StakeManager} stake, locking it here. The
    ///      caller must have already deposited at least `amount` of unlocked stake in the StakeManager.
    function stakeArbiter(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _requireNotGloballyPaused();

        IStakeManager stakeManager = IStakeManager(_addr(Keys.STAKE_MANAGER));
        uint256 unlocked = stakeManager.stakeOf(msg.sender) - stakeManager.lockedOf(msg.sender);
        if (amount > unlocked) revert InsufficientUnlockedStake(unlocked, amount);

        uint256 newStake = _arbiterStake[msg.sender] + amount;
        if (newStake < _minStake) revert BelowMinStake(newStake, _minStake);

        _arbiterStake[msg.sender] = newStake;
        stakeManager.lock(msg.sender, amount);

        emit ArbiterStaked(msg.sender, amount);
    }

    /// @inheritdoc IArbiterStaking
    /// @dev Un-commits `amount`, releasing the lock in the StakeManager (funds become withdrawable
    ///      there). Reverts while the arbiter has unresolved votes so their stake stays slashable.
    function unstakeArbiter(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (_pendingVotes[msg.sender] != 0) revert StakeLocked(msg.sender);

        uint256 committed = _arbiterStake[msg.sender];
        if (amount > committed) revert InsufficientArbiterStake(committed, amount);

        _arbiterStake[msg.sender] = committed - amount;
        IStakeManager(_addr(Keys.STAKE_MANAGER)).unlock(msg.sender, amount);

        emit ArbiterUnstaked(msg.sender, amount);
    }

    // --- coordination hooks (DisputeArbitration only) --------------------------------------

    /// @inheritdoc IArbiterCoordination
    function onVoteCast(address arbiter) external {
        _onlyDisputeModule();
        _pendingVotes[arbiter] += 1;
    }

    /// @inheritdoc IArbiterCoordination
    function onDisputeResolved(address arbiter) external {
        _onlyDisputeModule();
        uint256 pending = _pendingVotes[arbiter];
        if (pending != 0) {
            _pendingVotes[arbiter] = pending - 1;
        }
    }

    /// @inheritdoc IArbiterCoordination
    /// @dev Called immediately after the DisputeArbitration slashes `amount` of `arbiter`'s stake in
    ///      the StakeManager, so this module's committed-stake bookkeeping stays consistent.
    function onArbiterSlashed(address arbiter, uint256 amount) external {
        _onlyDisputeModule();
        uint256 committed = _arbiterStake[arbiter];
        _arbiterStake[arbiter] = amount >= committed ? 0 : committed - amount;
    }

    // --- views -----------------------------------------------------------------------------

    /// @inheritdoc IArbiterStaking
    function isArbiter(address account) external view returns (bool) {
        uint256 committed = _arbiterStake[account];
        return committed > 0 && committed >= _minStake;
    }

    /// @inheritdoc IArbiterStaking
    function stakeOf(address account) external view returns (uint256) {
        return _arbiterStake[account];
    }

    /// @inheritdoc IArbiterStaking
    function minStake() external view returns (uint256) {
        return _minStake;
    }

    /// @inheritdoc IArbiterCoordination
    function pendingVotesOf(address arbiter) external view returns (uint256) {
        return _pendingVotes[arbiter];
    }

    // --- internal --------------------------------------------------------------------------

    /// @dev Restrict a call to the {DisputeArbitration} contract registered in the AddressBook.
    function _onlyDisputeModule() private view {
        if (msg.sender != _addr(Keys.DISPUTE_ARBITRATION)) revert NotDisputeModule(msg.sender);
    }
}
