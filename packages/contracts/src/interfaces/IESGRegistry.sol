// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IESGRegistry
/// @notice ESG scores/attestations per subject (batch id or org id).
interface IESGRegistry {
    struct EsgRecord {
        bytes32 subject;
        uint16 score;
        string uri;
        uint64 updatedAt;
        address attestor;
        bool exists;
    }

    event EsgSet(bytes32 indexed subject, uint16 score, string uri, address indexed attestor);

    error InvalidScore(uint16 score);
    error EmptyURI();

    /// @notice Set the ESG score/attestation for a subject. Authorized attestor only.
    function setEsg(bytes32 subject, uint16 score, string calldata uri) external;

    function esgOf(bytes32 subject) external view returns (EsgRecord memory);
    function scoreOf(bytes32 subject) external view returns (uint16);
}
