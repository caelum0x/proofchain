// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ISafetyTrainingRegistry } from "../interfaces/ISafetyTrainingRegistry.sol";
import { IWorkerCredential } from "../interfaces/IWorkerCredential.sol";

/// @title SafetyTrainingRegistry
/// @notice Records completion of safety / occupational-health training courses by workers. An accredited
///         trainer (CERTIFIER_ROLE) registers courses with a validity period and records each worker's
///         completion; completions expire after the validity window and can be revoked on fraud/error.
///         Downstream gates (site access, payroll) read `isCurrent(courseId, worker)`.
/// @dev Peers resolved via the {AddressBook}. When {WorkerCredential} is wired, completions may only be
///      recorded for workers that hold an active credential (degrades gracefully when unset). Course
///      lifecycle and completions are gated to the course provider or CERTIFIER_ROLE.
contract SafetyTrainingRegistry is ProofChainAccess, ISafetyTrainingRegistry {
    /// @dev A day expressed in seconds, for validity-window arithmetic.
    uint64 private constant SECONDS_PER_DAY = 1 days;

    /// @dev courseId => course definition.
    mapping(bytes32 => Course) private _courses;
    /// @dev courseId => worker => completion record.
    mapping(bytes32 => mapping(address => Completion)) private _completions;

    /// @notice The referenced worker was the zero address.
    error ZeroWorker();
    /// @notice The worker does not hold an active {WorkerCredential} (enforced only when wired).
    error WorkerNotCredentialed(address worker);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial CERTIFIER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.CERTIFIER_ROLE, admin);
    }

    /// @inheritdoc ISafetyTrainingRegistry
    function registerCourse(bytes32 courseId, bytes32 title, uint32 validityDays, address provider)
        external
        onlyRole(Roles.CERTIFIER_ROLE)
    {
        _requireNotGloballyPaused();
        if (provider == address(0)) revert ZeroAddress();
        if (_courses[courseId].provider != address(0)) revert CourseExists(courseId);

        _courses[courseId] = Course({
            courseId: courseId,
            title: title,
            validityDays: validityDays,
            provider: provider,
            active: true
        });
        emit CourseRegistered(courseId, title, validityDays, provider);
    }

    /// @inheritdoc ISafetyTrainingRegistry
    function deactivateCourse(bytes32 courseId) external {
        _requireNotGloballyPaused();
        Course storage course = _requireCourse(courseId);
        _requireProviderOrCertifier(course, courseId);
        if (!course.active) revert CourseInactive(courseId);

        course.active = false;
        emit CourseDeactivated(courseId);
    }

    /// @inheritdoc ISafetyTrainingRegistry
    function recordCompletion(bytes32 courseId, address worker, bytes32 evidenceHash) external {
        _requireNotGloballyPaused();
        if (worker == address(0)) revert ZeroWorker();
        Course storage course = _requireCourse(courseId);
        _requireProviderOrCertifier(course, courseId);
        if (!course.active) revert CourseInactive(courseId);
        _requireActiveCredential(worker);

        uint64 completedAt = uint64(block.timestamp);
        uint64 expiresAt = course.validityDays == 0
            ? type(uint64).max
            : completedAt + uint64(course.validityDays) * SECONDS_PER_DAY;

        _completions[courseId][worker] = Completion({
            courseId: courseId,
            worker: worker,
            completedAt: completedAt,
            expiresAt: expiresAt,
            evidenceHash: evidenceHash,
            revoked: false
        });
        emit TrainingCompleted(courseId, worker, completedAt, expiresAt);
    }

    /// @inheritdoc ISafetyTrainingRegistry
    function revokeCompletion(bytes32 courseId, address worker, bytes32 reason) external {
        _requireNotGloballyPaused();
        Course storage course = _requireCourse(courseId);
        _requireProviderOrCertifier(course, courseId);

        Completion storage completion = _completions[courseId][worker];
        if (completion.completedAt == 0) revert NoCompletion(courseId, worker);
        if (completion.revoked) revert AlreadyRevoked(courseId, worker);

        completion.revoked = true;
        emit CompletionRevoked(courseId, worker, reason);
    }

    /// @inheritdoc ISafetyTrainingRegistry
    function isCurrent(bytes32 courseId, address worker) external view returns (bool) {
        Completion storage completion = _completions[courseId][worker];
        return completion.completedAt != 0 && !completion.revoked && completion.expiresAt > block.timestamp;
    }

    /// @inheritdoc ISafetyTrainingRegistry
    function courseOf(bytes32 courseId) external view returns (Course memory) {
        return _courses[courseId];
    }

    /// @inheritdoc ISafetyTrainingRegistry
    function completionOf(bytes32 courseId, address worker) external view returns (Completion memory) {
        return _completions[courseId][worker];
    }

    /// @dev Fetch a course by id or revert {UnknownCourse}.
    function _requireCourse(bytes32 courseId) private view returns (Course storage course) {
        course = _courses[courseId];
        if (course.provider == address(0)) revert UnknownCourse(courseId);
    }

    /// @dev Only the course provider or a CERTIFIER may manage a course / its completions.
    function _requireProviderOrCertifier(Course storage course, bytes32 courseId) private view {
        if (msg.sender != course.provider && !hasRole(Roles.CERTIFIER_ROLE, msg.sender)) {
            revert NotProvider(courseId);
        }
    }

    /// @dev Require the worker to hold an active {WorkerCredential} when that peer is wired.
    function _requireActiveCredential(address worker) private view {
        address wc = _addrOrZero(Keys.WORKER_CREDENTIAL);
        if (wc != address(0) && !IWorkerCredential(wc).isActive(worker)) {
            revert WorkerNotCredentialed(worker);
        }
    }
}
