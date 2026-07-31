// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { IProvenanceRegistry } from "./interfaces/IProvenanceRegistry.sol";

/// @title AttestationRegistry
/// @notice Stores AI-agent verdicts. Only the authorized agent signer may attest.
/// @dev One immutable attestation per batchId. Score is basis points (0..10000).
contract AttestationRegistry is AccessControl {
    /// @notice Role held by the verification agent keypair permitted to attest.
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    /// @notice Maximum score in basis points (100.00%).
    uint16 public constant MAX_SCORE = 10_000;

    /// @notice Provenance ground-truth; a batch must exist here to be attested.
    IProvenanceRegistry public immutable provenance;

    struct Attestation {
        bytes32 batchId;
        uint16 score;
        bytes32 verdictHash;
        string verdictURI;
        uint64 attestedAt;
        address agent;
        bool exists;
    }

    mapping(bytes32 => Attestation) private _attestations;

    event Attested(
        bytes32 indexed batchId, uint16 score, bytes32 verdictHash, string verdictURI, address indexed agent
    );

    error InvalidScore(uint16 score);
    error AlreadyAttested(bytes32 batchId);
    error NotAttested(bytes32 batchId);
    error UnknownBatch(bytes32 batchId);
    error ZeroAddress();

    /// @param admin Address granted DEFAULT_ADMIN_ROLE at deploy time.
    /// @param provenanceRegistry Address of the ProvenanceRegistry (ground truth).
    constructor(address admin, address provenanceRegistry) {
        if (admin == address(0) || provenanceRegistry == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        provenance = IProvenanceRegistry(provenanceRegistry);
    }

    /// @notice Write an immutable attestation for a batch.
    /// @param batchId Batch being attested (one attestation per batch).
    /// @param score Fraud/quality score in bps (0..10000).
    /// @param verdictHash Hash committing to the full verdict document.
    /// @param verdictURI Off-chain pointer to the verdict document.
    function attest(bytes32 batchId, uint16 score, bytes32 verdictHash, string calldata verdictURI)
        external
        onlyRole(AGENT_ROLE)
    {
        if (!provenance.batchExists(batchId)) revert UnknownBatch(batchId);
        if (score > MAX_SCORE) revert InvalidScore(score);
        if (_attestations[batchId].exists) revert AlreadyAttested(batchId);

        _attestations[batchId] = Attestation({
            batchId: batchId,
            score: score,
            verdictHash: verdictHash,
            verdictURI: verdictURI,
            attestedAt: uint64(block.timestamp),
            agent: msg.sender,
            exists: true
        });

        emit Attested(batchId, score, verdictHash, verdictURI, msg.sender);
    }

    /// @notice Fetch an attestation by batch id.
    function getAttestation(bytes32 batchId) external view returns (Attestation memory) {
        return _attestations[batchId];
    }

    /// @notice Whether a batch has an attestation.
    function isAttested(bytes32 batchId) external view returns (bool) {
        return _attestations[batchId].exists;
    }

    /// @notice Score of a batch; reverts NotAttested if none exists.
    function scoreOf(bytes32 batchId) external view returns (uint16) {
        if (!_attestations[batchId].exists) revert NotAttested(batchId);
        return _attestations[batchId].score;
    }
}
