// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { IRewardsDistributor } from "../interfaces/IRewardsDistributor.sol";

/// @title RewardsDistributor
/// @notice Merkle-based reward distribution: an admin publishes a per-epoch root committing to
///         `(account, amount)` allocations, and participants pull their rewards by presenting a
///         proof. This scales to arbitrarily many recipients with O(1) on-chain storage per epoch.
/// @dev Each epoch pins its own reward token, so distinct campaigns (PROOF emissions, USDC
///      rebates, ...) can run in parallel. Leaves use the OpenZeppelin double-hash convention
///      `keccak256(bytes.concat(keccak256(abi.encode(account, amount))))` to guard against
///      second-preimage attacks. Every claim moves funds under `nonReentrant` + `SafeERC20`.
contract RewardsDistributor is ProofChainAccess, ReentrancyGuard, IRewardsDistributor {
    using SafeERC20 for IERC20;

    struct Epoch {
        bytes32 root;
        address token;
    }

    /// @notice Published epoch => merkle root + reward token.
    mapping(uint256 => Epoch) private _epochs;

    /// @notice epoch => account => whether the account has already claimed.
    mapping(uint256 => mapping(address => bool)) private _claimed;

    error ZeroRoot();
    error EpochAlreadySet(uint256 epoch);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE (may publish roots).
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IRewardsDistributor
    /// @dev Roots are immutable once set for an epoch: overwriting a live root would let an admin
    ///      retroactively invalidate outstanding claims, so we forbid it.
    function setRoot(uint256 epoch, bytes32 root, address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (root == bytes32(0)) revert ZeroRoot();
        if (token == address(0)) revert ZeroAddress();
        if (_epochs[epoch].root != bytes32(0)) revert EpochAlreadySet(epoch);

        _epochs[epoch] = Epoch({ root: root, token: token });
        emit RootSet(root, epoch);
    }

    /// @inheritdoc IRewardsDistributor
    function claim(uint256 epoch, uint256 amount, bytes32[] calldata proof) external nonReentrant {
        _requireNotGloballyPaused();

        Epoch memory e = _epochs[epoch];
        if (e.root == bytes32(0)) revert UnknownEpoch(epoch);
        if (_claimed[epoch][msg.sender]) revert AlreadyClaimed(msg.sender, epoch);

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        if (!MerkleProof.verify(proof, e.root, leaf)) revert InvalidProof(msg.sender);

        _claimed[epoch][msg.sender] = true;
        IERC20(e.token).safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, epoch, amount);
    }

    /// @inheritdoc IRewardsDistributor
    function isClaimed(uint256 epoch, address account) external view returns (bool) {
        return _claimed[epoch][account];
    }

    /// @notice The published merkle root for an epoch (zero if unset).
    function rootOf(uint256 epoch) external view returns (bytes32) {
        return _epochs[epoch].root;
    }

    /// @notice The reward token pinned to an epoch (zero if unset).
    function tokenOf(uint256 epoch) external view returns (address) {
        return _epochs[epoch].token;
    }
}
