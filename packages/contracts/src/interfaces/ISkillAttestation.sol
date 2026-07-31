// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISkillAttestation
/// @notice Verifiable skill / competency attestations for workers. An accredited attester asserts that a
///         worker holds a skill at a proficiency level against a named framework, with optional expiry and
///         evidence. Attestations are immutable but revocable, forming a portable, verifiable skill graph.
/// @dev deps (AddressBook): WorkerCredential, IdentityResolver, SafetyTrainingRegistry.
interface ISkillAttestation {
    struct Attestation {
        bytes32 attestationId;
        address worker;
        address attester;
        bytes32 skill;
        bytes32 framework;
        uint8 level;
        bytes32 evidenceHash;
        uint64 attestedAt;
        uint64 expiresAt;
        bool revoked;
    }

    event SkillAttested(
        bytes32 indexed attestationId, address indexed worker, address indexed attester, bytes32 skill, uint8 level
    );
    event AttestationRevoked(bytes32 indexed attestationId, bytes32 reason);

    error AttestationExists(bytes32 attestationId);
    error UnknownAttestation(bytes32 attestationId);
    error AlreadyRevoked(bytes32 attestationId);
    error NotAttester(bytes32 attestationId);
    error InvalidLevel(uint8 level);
    error ZeroWorker();

    /// @notice Attest a worker's skill at a proficiency level. CERTIFIER_ROLE / accredited attester.
    function attest(
        bytes32 attestationId,
        address worker,
        bytes32 skill,
        bytes32 framework,
        uint8 level,
        bytes32 evidenceHash,
        uint64 expiresAt
    ) external;

    /// @notice Revoke a prior attestation. Issuing attester / CERTIFIER_ROLE.
    function revoke(bytes32 attestationId, bytes32 reason) external;

    /// @notice True if the worker holds a current (non-revoked, unexpired) attestation for the skill at >= level.
    function hasSkill(address worker, bytes32 skill, uint8 minLevel) external view returns (bool);

    function attestationOf(bytes32 attestationId) external view returns (Attestation memory);
}
