// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ISkillAttestation } from "../interfaces/ISkillAttestation.sol";
import { IWorkerCredential } from "../interfaces/IWorkerCredential.sol";

/// @title SkillAttestation
/// @notice Verifiable skill / competency attestations for workers. An accredited attester (CERTIFIER_ROLE)
///         asserts that a worker holds a skill at a proficiency level against a named framework, with
///         optional expiry and evidence. Attestations are immutable once written but revocable, forming a
///         portable, verifiable skill graph read via `hasSkill(worker, skill, minLevel)`.
/// @dev Peers resolved via the {AddressBook}. When {WorkerCredential} is wired, skills can only be attested
///      for workers holding an active credential (degrades gracefully when unset). `hasSkill` resolves the
///      latest attestation recorded for a (worker, skill) pair — a newer attestation supersedes older ones.
contract SkillAttestation is ProofChainAccess, ISkillAttestation {
    /// @notice Maximum supported proficiency level (frameworks are normalised to a 1..5 scale).
    uint8 public constant MAX_LEVEL = 5;

    /// @notice The worker does not hold an active {WorkerCredential} (enforced only when wired).
    error WorkerNotCredentialed(address worker);

    /// @dev attestationId => attestation record.
    mapping(bytes32 => Attestation) private _attestations;
    /// @dev worker => skill => id of the most recent attestation (used by `hasSkill`).
    mapping(address => mapping(bytes32 => bytes32)) private _latest;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial CERTIFIER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.CERTIFIER_ROLE, admin);
    }

    /// @inheritdoc ISkillAttestation
    function attest(
        bytes32 attestationId,
        address worker,
        bytes32 skill,
        bytes32 framework,
        uint8 level,
        bytes32 evidenceHash,
        uint64 expiresAt
    ) external onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        if (worker == address(0)) revert ZeroWorker();
        if (level == 0 || level > MAX_LEVEL) revert InvalidLevel(level);
        if (_attestations[attestationId].attestedAt != 0) revert AttestationExists(attestationId);
        _requireActiveCredential(worker);

        _attestations[attestationId] = Attestation({
            attestationId: attestationId,
            worker: worker,
            attester: msg.sender,
            skill: skill,
            framework: framework,
            level: level,
            evidenceHash: evidenceHash,
            attestedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false
        });
        _latest[worker][skill] = attestationId;

        emit SkillAttested(attestationId, worker, msg.sender, skill, level);
    }

    /// @inheritdoc ISkillAttestation
    function revoke(bytes32 attestationId, bytes32 reason) external {
        _requireNotGloballyPaused();
        Attestation storage att = _attestations[attestationId];
        if (att.attestedAt == 0) revert UnknownAttestation(attestationId);
        if (att.revoked) revert AlreadyRevoked(attestationId);
        if (msg.sender != att.attester && !hasRole(Roles.CERTIFIER_ROLE, msg.sender)) {
            revert NotAttester(attestationId);
        }

        att.revoked = true;
        emit AttestationRevoked(attestationId, reason);
    }

    /// @inheritdoc ISkillAttestation
    function hasSkill(address worker, bytes32 skill, uint8 minLevel) external view returns (bool) {
        bytes32 attestationId = _latest[worker][skill];
        if (attestationId == bytes32(0)) return false;
        Attestation storage att = _attestations[attestationId];
        if (att.revoked || att.level < minLevel) return false;
        if (att.expiresAt != 0 && att.expiresAt <= block.timestamp) return false;
        return true;
    }

    /// @inheritdoc ISkillAttestation
    function attestationOf(bytes32 attestationId) external view returns (Attestation memory) {
        return _attestations[attestationId];
    }

    /// @dev Require the worker to hold an active {WorkerCredential} when that peer is wired.
    function _requireActiveCredential(address worker) private view {
        address wc = _addrOrZero(Keys.WORKER_CREDENTIAL);
        if (wc != address(0) && !IWorkerCredential(wc).isActive(worker)) {
            revert WorkerNotCredentialed(worker);
        }
    }
}
