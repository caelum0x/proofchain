// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IRecyclingRegistry } from "../interfaces/IRecyclingRegistry.sol";
import { IDigitalProductPassport } from "../interfaces/IDigitalProductPassport.sol";
import { IDPPLifecycleRegistry } from "../interfaces/IDPPLifecycleRegistry.sol";

/// @title RecyclingRegistry
/// @notice End-of-life register for Digital Product Passports. An accredited recycler records the
///         collection, processing and material recovery of a passported product, closing the loop
///         by reporting recovered mass and a computed recovery rate. When recovery is confirmed the
///         passport's lifecycle log is stamped with a `Recycled` event (best-effort).
/// @dev Resolves the {DigitalProductPassport} and (optionally) the {DPPLifecycleRegistry} through
///      the {AddressBook}. Only {Roles.CERTIFIER_ROLE} holders (accredited recyclers) may write.
///      The record follows a strict state machine: Collected → Processing → Recovered/Disposed.
contract RecyclingRegistry is ProofChainAccess, IRecyclingRegistry {
    /// @dev 100.00% expressed in basis points.
    uint16 private constant BPS_DENOMINATOR = 10_000;

    /// @dev recordId => record.
    mapping(bytes32 => RecycleRecord) private _records;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the DigitalProductPassport.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial CERTIFIER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.CERTIFIER_ROLE, admin);
    }

    /// @inheritdoc IRecyclingRegistry
    function recordCollection(bytes32 recordId, uint256 tokenId, uint256 inputMassGrams, bytes32 facilityId)
        external
        override
        onlyRole(Roles.CERTIFIER_ROLE)
    {
        _requireNotGloballyPaused();
        if (_records[recordId].state != RecycleState.None) revert RecordExists(recordId);
        if (inputMassGrams == 0) revert ZeroMass();

        IDigitalProductPassport dpp = IDigitalProductPassport(_addr(Keys.DIGITAL_PRODUCT_PASSPORT));
        IDigitalProductPassport.Passport memory p = dpp.passportOf(tokenId);
        if (p.status == IDigitalProductPassport.PassportStatus.None) revert UnknownPassport(tokenId);

        _records[recordId] = RecycleRecord({
            recordId: recordId,
            tokenId: tokenId,
            recycler: msg.sender,
            inputMassGrams: inputMassGrams,
            recoveredMassGrams: 0,
            facilityId: facilityId,
            state: RecycleState.Collected,
            updatedAt: uint64(block.timestamp)
        });

        emit Collected(recordId, tokenId, msg.sender, inputMassGrams);
    }

    /// @inheritdoc IRecyclingRegistry
    function startProcessing(bytes32 recordId) external override onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        RecycleRecord storage r = _requireRecord(recordId);
        if (r.state != RecycleState.Collected) {
            revert InvalidState(recordId, RecycleState.Collected, r.state);
        }
        r.state = RecycleState.Processing;
        r.updatedAt = uint64(block.timestamp);

        emit Processing(recordId);
    }

    /// @inheritdoc IRecyclingRegistry
    function recordRecovery(bytes32 recordId, uint256 recoveredMassGrams)
        external
        override
        onlyRole(Roles.CERTIFIER_ROLE)
    {
        _requireNotGloballyPaused();
        RecycleRecord storage r = _requireRecord(recordId);
        if (r.state != RecycleState.Processing) {
            revert InvalidState(recordId, RecycleState.Processing, r.state);
        }
        if (recoveredMassGrams == 0) revert ZeroMass();
        if (recoveredMassGrams > r.inputMassGrams) {
            revert RecoveredExceedsInput(recoveredMassGrams, r.inputMassGrams);
        }

        r.recoveredMassGrams = recoveredMassGrams;
        r.state = RecycleState.Recovered;
        r.updatedAt = uint64(block.timestamp);

        uint16 recoveryRateBps = uint16((recoveredMassGrams * BPS_DENOMINATOR) / r.inputMassGrams);
        emit Recovered(recordId, recoveredMassGrams, recoveryRateBps);

        // Close the loop: stamp the passport's lifecycle history with a Recycled event when the
        // optional lifecycle registry is wired and has granted this contract REGISTRAR_ROLE.
        _stampRecycled(r.tokenId, recordId);
    }

    /// @inheritdoc IRecyclingRegistry
    function recordDisposal(bytes32 recordId, uint256 residualMassGrams)
        external
        override
        onlyRole(Roles.CERTIFIER_ROLE)
    {
        _requireNotGloballyPaused();
        RecycleRecord storage r = _requireRecord(recordId);
        // Residual disposal can follow collection, processing, or recovery, but not a terminal state.
        if (r.state == RecycleState.None || r.state == RecycleState.Disposed) {
            revert InvalidState(recordId, RecycleState.Recovered, r.state);
        }

        r.state = RecycleState.Disposed;
        r.updatedAt = uint64(block.timestamp);

        emit Disposed(recordId, residualMassGrams);
    }

    /// @inheritdoc IRecyclingRegistry
    function recordOf(bytes32 recordId) external view override returns (RecycleRecord memory) {
        return _records[recordId];
    }

    /// @dev Load a record, reverting if it does not exist.
    function _requireRecord(bytes32 recordId) private view returns (RecycleRecord storage r) {
        r = _records[recordId];
        if (r.state == RecycleState.None) revert UnknownRecord(recordId);
    }

    /// @dev Best-effort append of a `Recycled` lifecycle event. The lifecycle registry is an
    ///      optional dependency; if it is unwired or has not granted this contract REGISTRAR_ROLE,
    ///      the recovery record still stands on its own and the append is simply skipped.
    function _stampRecycled(uint256 tokenId, bytes32 recordId) private {
        address lifecycle = _addrOrZero(Keys.DPP_LIFECYCLE_REGISTRY);
        if (lifecycle == address(0)) return;
        try IDPPLifecycleRegistry(lifecycle).record(
            tokenId, IDPPLifecycleRegistry.EventType.Recycled, recordId, ""
        ) returns (uint256) {
            // stamped
        } catch {
            // Lifecycle registry present but this contract lacks REGISTRAR_ROLE; recovery stands.
        }
    }
}
