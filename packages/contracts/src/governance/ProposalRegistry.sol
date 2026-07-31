// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IProposalRegistry } from "../interfaces/IProposalRegistry.sol";

/// @title ProposalRegistry
/// @notice Human-readable metadata index for governance proposals. The on-chain {ProofChainGovernor}
///         stores only hashes; this registry lets a proposer attach an off-chain metadata URI
///         (IPFS/HTTPS) describing the proposal in full for UIs and indexers.
/// @dev Permissionless-but-immutable: any account may attach a description to a proposal id exactly
///      once. The first writer's address is recorded as the author. Descriptions are immutable so a
///      proposal's advertised intent cannot be silently rewritten after voting begins.
contract ProposalRegistry is IProposalRegistry {
    struct Description {
        string uri;
        address author;
        uint64 describedAt;
    }

    /// @notice Metadata attached to each proposal id (zero-value if never described).
    mapping(uint256 => Description) private _descriptions;

    /// @inheritdoc IProposalRegistry
    function describe(uint256 proposalId, string calldata uri) external {
        if (bytes(uri).length == 0) revert EmptyURI();
        if (_descriptions[proposalId].author != address(0)) revert AlreadyDescribed(proposalId);

        _descriptions[proposalId] =
            Description({ uri: uri, author: msg.sender, describedAt: uint64(block.timestamp) });

        emit ProposalDescribed(proposalId, uri, msg.sender);
    }

    /// @inheritdoc IProposalRegistry
    function descriptionOf(uint256 proposalId) external view returns (string memory) {
        return _descriptions[proposalId].uri;
    }

    /// @notice The address that first described `proposalId` (zero if undescribed).
    function authorOf(uint256 proposalId) external view returns (address) {
        return _descriptions[proposalId].author;
    }

    /// @notice Whether `proposalId` already has a description attached.
    function isDescribed(uint256 proposalId) external view returns (bool) {
        return _descriptions[proposalId].author != address(0);
    }
}
