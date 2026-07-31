// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISafetyTrainingRegistry
/// @notice Records completion of safety / occupational-health training courses by workers. An accredited
///         trainer defines courses (with validity periods) and records a worker's completion; completions
///         expire and can be revoked. Downstream gates (site access, payroll) query current validity.
/// @dev deps (AddressBook): WorkerCredential, LaborComplianceRegistry, IdentityResolver.
interface ISafetyTrainingRegistry {
    struct Course {
        bytes32 courseId;
        bytes32 title;
        uint32 validityDays;
        address provider;
        bool active;
    }

    struct Completion {
        bytes32 courseId;
        address worker;
        uint64 completedAt;
        uint64 expiresAt;
        bytes32 evidenceHash;
        bool revoked;
    }

    event CourseRegistered(bytes32 indexed courseId, bytes32 title, uint32 validityDays, address indexed provider);
    event CourseDeactivated(bytes32 indexed courseId);
    event TrainingCompleted(bytes32 indexed courseId, address indexed worker, uint64 completedAt, uint64 expiresAt);
    event CompletionRevoked(bytes32 indexed courseId, address indexed worker, bytes32 reason);

    error CourseExists(bytes32 courseId);
    error UnknownCourse(bytes32 courseId);
    error CourseInactive(bytes32 courseId);
    error NotProvider(bytes32 courseId);
    error NoCompletion(bytes32 courseId, address worker);
    error AlreadyRevoked(bytes32 courseId, address worker);

    /// @notice Register a safety training course. CERTIFIER_ROLE only.
    function registerCourse(bytes32 courseId, bytes32 title, uint32 validityDays, address provider) external;

    /// @notice Deactivate a course so no further completions can be recorded.
    function deactivateCourse(bytes32 courseId) external;

    /// @notice Record a worker's completion of a course. The course provider / CERTIFIER_ROLE.
    function recordCompletion(bytes32 courseId, address worker, bytes32 evidenceHash) external;

    /// @notice Revoke a recorded completion (fraud/error). Provider / CERTIFIER_ROLE.
    function revokeCompletion(bytes32 courseId, address worker, bytes32 reason) external;

    /// @notice True if the worker holds a current (non-revoked, unexpired) completion for the course.
    function isCurrent(bytes32 courseId, address worker) external view returns (bool);

    function courseOf(bytes32 courseId) external view returns (Course memory);
    function completionOf(bytes32 courseId, address worker) external view returns (Completion memory);
}
