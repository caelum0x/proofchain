// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IGradingRegistry
/// @notice Accredited graders assign a quality grade to a commodity lot against a named grading standard
///         (e.g. USDA, ICO). Each grading is an immutable attestation carrying a numeric score, grade class,
///         and evidence hash; graders can revoke a prior grading on discovered error/fraud.
/// @dev deps (AddressBook): HarvestRegistry, ProvenanceRegistry, IdentityResolver.
interface IGradingRegistry {
    struct Grading {
        bytes32 gradingId;
        bytes32 lotId;
        bytes32 standard;
        bytes32 grade;
        uint16 score;
        address grader;
        bytes32 evidenceHash;
        uint64 gradedAt;
        bool revoked;
    }

    event Graded(
        bytes32 indexed gradingId,
        bytes32 indexed lotId,
        bytes32 indexed standard,
        bytes32 grade,
        uint16 score,
        address grader
    );
    event GradingRevoked(bytes32 indexed gradingId, bytes32 reason);

    error GradingExists(bytes32 gradingId);
    error UnknownGrading(bytes32 gradingId);
    error AlreadyRevoked(bytes32 gradingId);
    error NotGrader(bytes32 gradingId);
    error ScoreOutOfRange(uint16 score);
    error ZeroLot();

    /// @notice Record a grading for a lot. GRADER_ROLE only. Score is 0..10000 bps of the standard's max.
    function grade(
        bytes32 gradingId,
        bytes32 lotId,
        bytes32 standard,
        bytes32 gradeClass,
        uint16 score,
        bytes32 evidenceHash
    ) external;

    /// @notice Revoke a prior grading. The issuing grader or GRADER_ROLE admin.
    function revoke(bytes32 gradingId, bytes32 reason) external;

    /// @notice Latest non-revoked grading id recorded for a lot (0 if none).
    function latestGradingOf(bytes32 lotId) external view returns (bytes32);

    function gradingOf(bytes32 gradingId) external view returns (Grading memory);
}
