// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IAttestationRegistry
/// @notice Full external surface of the AI-agent verdict store (one attestation per batch).
/// @dev Peers (escrow, finance, insurance) import THIS interface, never the impl.
interface IAttestationRegistry {
    struct Attestation {
        bytes32 batchId;
        uint16 score;
        bytes32 verdictHash;
        string verdictURI;
        uint64 attestedAt;
        address agent;
        bool exists;
    }

    event Attested(
        bytes32 indexed batchId, uint16 score, bytes32 verdictHash, string verdictURI, address indexed agent
    );

    error InvalidScore(uint16 score);
    error AlreadyAttested(bytes32 batchId);
    error NotAttested(bytes32 batchId);
    error UnknownBatch(bytes32 batchId);
    error ZeroAddress();

    function AGENT_ROLE() external view returns (bytes32);

    function attest(bytes32 batchId, uint16 score, bytes32 verdictHash, string calldata verdictURI) external;

    function getAttestation(bytes32 batchId) external view returns (Attestation memory);
    function isAttested(bytes32 batchId) external view returns (bool);
    function scoreOf(bytes32 batchId) external view returns (uint16);
}
