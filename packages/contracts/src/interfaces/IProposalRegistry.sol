// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IProposalRegistry
/// @notice Human-readable metadata index for governance proposals.
interface IProposalRegistry {
    event ProposalDescribed(uint256 indexed proposalId, string uri, address indexed author);

    error AlreadyDescribed(uint256 proposalId);
    error EmptyURI();

    /// @notice Attach a metadata URI to a proposal id.
    function describe(uint256 proposalId, string calldata uri) external;

    function descriptionOf(uint256 proposalId) external view returns (string memory);
}
