// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IMilestonePayroll } from "../interfaces/IMilestonePayroll.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";
import { IWorkerCredential } from "../interfaces/IWorkerCredential.sol";
import { IAttestationRegistry } from "../interfaces/IAttestationRegistry.sol";

/// @title MilestonePayroll
/// @notice Stablecoin payroll where a worker is paid per delivery milestone. An employer funds an
///         agreement up-front (the whole `totalAmount` is escrowed here), defines milestones with amounts
///         that sum to the total, approves each milestone (optionally referencing a delivery attestation),
///         and releases the approved milestone's payment to the worker. Unreleased funds are refunded to
///         the employer on cancel.
/// @dev All fund movement uses {SafeERC20} + `nonReentrant`. Peers resolved via the {AddressBook}: the
///      settlement token is checked against the {StablecoinRegistry} allowlist, the worker against the
///      {WorkerCredential} (both enforced only when wired), and a referenced delivery attestation against
///      the {AttestationRegistry}. Implements {IMilestonePayroll}.
contract MilestonePayroll is ProofChainAccess, ReentrancyGuard, IMilestonePayroll {
    using SafeERC20 for IERC20;

    /// @dev agreementId => agreement header.
    mapping(bytes32 => Agreement) private _agreements;
    /// @dev agreementId => ordered milestones.
    mapping(bytes32 => Milestone[]) private _milestones;

    /// @notice The milestone-amount and description arrays had mismatched or empty lengths.
    error LengthMismatch(uint256 amounts, uint256 descriptions);
    /// @notice More milestones were supplied than the uint16 milestone counter can index.
    error TooManyMilestones(uint256 count);
    /// @notice A settlement token outside the {StablecoinRegistry} allowlist was supplied.
    error TokenNotAccepted(address token);
    /// @notice The worker does not hold an active {WorkerCredential} (enforced only when wired).
    error WorkerNotCredentialed(address worker);
    /// @notice The referenced delivery attestation is not present in the {AttestationRegistry}.
    error DeliveryNotAttested(bytes32 attestationId);
    /// @notice Only the worker, employer or an AGENT may perform this action.
    error NotAuthorized(bytes32 agreementId);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial AGENT_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.AGENT_ROLE, admin);
    }

    /// @inheritdoc IMilestonePayroll
    function createAgreement(
        bytes32 agreementId,
        address worker,
        address token,
        uint256 totalAmount,
        uint256[] calldata milestoneAmounts,
        bytes32[] calldata descriptionHashes
    ) external nonReentrant {
        _requireNotGloballyPaused();
        if (_agreements[agreementId].state != AgreementState.None) revert AgreementExists(agreementId);
        if (worker == address(0) || token == address(0)) revert ZeroAddress();
        if (totalAmount == 0) revert ZeroAmount();
        uint256 count = milestoneAmounts.length;
        if (count == 0 || count != descriptionHashes.length) {
            revert LengthMismatch(count, descriptionHashes.length);
        }
        if (count > type(uint16).max) revert TooManyMilestones(count);
        _requireAcceptedToken(token);
        _requireActiveCredential(worker);

        uint256 sum;
        for (uint256 i = 0; i < count; ++i) {
            if (milestoneAmounts[i] == 0) revert ZeroAmount();
            sum += milestoneAmounts[i];
            _milestones[agreementId].push(
                Milestone({
                    descriptionHash: descriptionHashes[i],
                    amount: milestoneAmounts[i],
                    attestationId: bytes32(0),
                    state: MilestoneState.Pending
                })
            );
        }
        if (sum != totalAmount) revert MilestoneSumMismatch(totalAmount, sum);

        _agreements[agreementId] = Agreement({
            agreementId: agreementId,
            employer: msg.sender,
            worker: worker,
            token: token,
            totalAmount: totalAmount,
            releasedAmount: 0,
            milestoneCount: uint16(count),
            releasedCount: 0,
            state: AgreementState.Active
        });

        // Escrow the full payroll up-front so every milestone is pre-funded.
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        emit AgreementCreated(agreementId, msg.sender, worker, token, totalAmount);
        for (uint16 i = 0; i < uint16(count); ++i) {
            emit MilestoneAdded(agreementId, i, milestoneAmounts[i], descriptionHashes[i]);
        }
    }

    /// @inheritdoc IMilestonePayroll
    function approveMilestone(bytes32 agreementId, uint16 index, bytes32 attestationId) external {
        _requireNotGloballyPaused();
        Agreement storage a = _requireActive(agreementId);
        if (msg.sender != a.employer && !hasRole(Roles.AGENT_ROLE, msg.sender)) revert NotEmployer(agreementId);

        Milestone storage m = _requireMilestone(agreementId, index);
        if (m.state != MilestoneState.Pending) {
            revert InvalidMilestoneState(agreementId, index, MilestoneState.Pending, m.state);
        }
        // If a delivery attestation is referenced, it must exist in the AI-verdict store (when wired).
        if (attestationId != bytes32(0)) {
            _requireDeliveryAttested(attestationId);
        }

        m.state = MilestoneState.Approved;
        m.attestationId = attestationId;
        emit MilestoneApproved(agreementId, index, attestationId);
    }

    /// @inheritdoc IMilestonePayroll
    function releaseMilestone(bytes32 agreementId, uint16 index) external nonReentrant {
        _requireNotGloballyPaused();
        Agreement storage a = _requireActive(agreementId);
        if (msg.sender != a.employer && msg.sender != a.worker && !hasRole(Roles.AGENT_ROLE, msg.sender)) {
            revert NotAuthorized(agreementId);
        }

        Milestone storage m = _requireMilestone(agreementId, index);
        if (m.state != MilestoneState.Approved) {
            revert InvalidMilestoneState(agreementId, index, MilestoneState.Approved, m.state);
        }

        uint256 amount = m.amount;
        m.state = MilestoneState.Released;
        a.releasedAmount += amount;
        a.releasedCount += 1;

        bool completed = a.releasedCount == a.milestoneCount;
        if (completed) a.state = AgreementState.Completed;

        IERC20(a.token).safeTransfer(a.worker, amount);

        emit MilestoneReleased(agreementId, index, a.worker, amount);
        if (completed) emit AgreementCompleted(agreementId);
    }

    /// @inheritdoc IMilestonePayroll
    function cancel(bytes32 agreementId) external nonReentrant {
        _requireNotGloballyPaused();
        Agreement storage a = _requireActive(agreementId);
        if (msg.sender != a.employer) revert NotEmployer(agreementId);

        // Cancel every still-open milestone so no further release is possible.
        Milestone[] storage ms = _milestones[agreementId];
        uint256 len = ms.length;
        for (uint256 i = 0; i < len; ++i) {
            MilestoneState s = ms[i].state;
            if (s == MilestoneState.Pending || s == MilestoneState.Approved) {
                ms[i].state = MilestoneState.Cancelled;
            }
        }

        uint256 refund = a.totalAmount - a.releasedAmount;
        a.state = AgreementState.Cancelled;

        if (refund > 0) IERC20(a.token).safeTransfer(a.employer, refund);
        emit AgreementCancelled(agreementId, refund);
    }

    /// @inheritdoc IMilestonePayroll
    function unreleasedBalance(bytes32 agreementId) external view returns (uint256) {
        Agreement storage a = _agreements[agreementId];
        if (a.state == AgreementState.None || a.state == AgreementState.Cancelled) return 0;
        return a.totalAmount - a.releasedAmount;
    }

    /// @inheritdoc IMilestonePayroll
    function agreementOf(bytes32 agreementId) external view returns (Agreement memory) {
        return _agreements[agreementId];
    }

    /// @inheritdoc IMilestonePayroll
    function milestoneAt(bytes32 agreementId, uint16 index) external view returns (Milestone memory) {
        if (index >= _milestones[agreementId].length) revert IndexOutOfRange(agreementId, index);
        return _milestones[agreementId][index];
    }

    /// @dev Fetch an agreement and require it to be in the Active state.
    function _requireActive(bytes32 agreementId) private view returns (Agreement storage a) {
        a = _agreements[agreementId];
        if (a.state == AgreementState.None) revert UnknownAgreement(agreementId);
        if (a.state != AgreementState.Active) revert InvalidState(agreementId, AgreementState.Active, a.state);
    }

    /// @dev Fetch a milestone by index or revert {IndexOutOfRange}.
    function _requireMilestone(bytes32 agreementId, uint16 index) private view returns (Milestone storage) {
        if (index >= _milestones[agreementId].length) revert IndexOutOfRange(agreementId, index);
        return _milestones[agreementId][index];
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAcceptedToken(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }

    /// @dev Require the worker to hold an active {WorkerCredential} when that peer is wired.
    function _requireActiveCredential(address worker) private view {
        address wc = _addrOrZero(Keys.WORKER_CREDENTIAL);
        if (wc != address(0) && !IWorkerCredential(wc).isActive(worker)) {
            revert WorkerNotCredentialed(worker);
        }
    }

    /// @dev Require the referenced delivery attestation to exist in the {AttestationRegistry} when wired.
    function _requireDeliveryAttested(bytes32 attestationId) private view {
        address reg = _addrOrZero(Keys.ATTESTATION_REGISTRY);
        if (reg != address(0) && !IAttestationRegistry(reg).isAttested(attestationId)) {
            revert DeliveryNotAttested(attestationId);
        }
    }
}
