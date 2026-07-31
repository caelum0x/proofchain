// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { ILabTestAttestation } from "../interfaces/ILabTestAttestation.sol";

/// @title LabTestAttestation
/// @notice Accredited laboratories attest analytical test results for a sample drawn from a batch/lot
///         (pesticide residue, moisture, heavy metals, microbiology, ...). Each result records the
///         measured value against a spec limit plus a pass/fail/inconclusive verdict, forming a
///         tamper-evident certificate of analysis. Multiple tests accumulate per lot; {allTestsPassing}
///         gates downstream acceptance once every non-revoked test for the lot has passed.
/// @dev Attestations are append-only; errors/fraud are handled by {revoke} (never mutation). Peers read
///      this registry through {ILabTestAttestation} resolved via the {AddressBook}.
contract LabTestAttestation is ProofChainAccess, ILabTestAttestation {
    /// @dev testId => lab test record.
    mapping(bytes32 => LabTest) private _tests;

    /// @dev lotId => ordered list of testIds recorded for the lot (oldest first).
    mapping(bytes32 => bytes32[]) private _lotTests;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc ILabTestAttestation
    function attest(
        bytes32 testId,
        bytes32 lotId,
        bytes32 sampleId,
        bytes32 analyte,
        bytes32 method,
        int256 measuredValue,
        int256 limitValue,
        uint8 decimals,
        Result result,
        bytes32 reportHash
    ) external override onlyRole(Roles.INSPECTOR_ROLE) {
        _requireNotGloballyPaused();
        if (lotId == bytes32(0)) revert ZeroLot();
        if (_tests[testId].lab != address(0)) revert TestExists(testId);

        _tests[testId] = LabTest({
            testId: testId,
            lotId: lotId,
            sampleId: sampleId,
            lab: msg.sender,
            analyte: analyte,
            method: method,
            measuredValue: measuredValue,
            limitValue: limitValue,
            decimals: decimals,
            result: result,
            reportHash: reportHash,
            testedAt: uint64(block.timestamp),
            revoked: false
        });
        _lotTests[lotId].push(testId);

        emit LabTestAttested(testId, lotId, msg.sender, analyte, result);
    }

    /// @inheritdoc ILabTestAttestation
    function revoke(bytes32 testId, bytes32 reason) external override {
        _requireNotGloballyPaused();
        LabTest storage t = _tests[testId];
        if (t.lab == address(0)) revert UnknownTest(testId);
        if (msg.sender != t.lab && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotLab(testId);
        if (t.revoked) revert AlreadyRevoked(testId);

        t.revoked = true;
        emit LabTestRevoked(testId, reason);
    }

    /// @inheritdoc ILabTestAttestation
    function allTestsPassing(bytes32 lotId) external view override returns (bool) {
        bytes32[] storage ids = _lotTests[lotId];
        uint256 valid;
        for (uint256 i; i < ids.length; ++i) {
            LabTest storage t = _tests[ids[i]];
            if (t.revoked) continue;
            if (t.result != Result.Pass) return false;
            unchecked {
                ++valid;
            }
        }
        // Require at least one non-revoked, passing test — an untested lot is not "passing".
        return valid > 0;
    }

    /// @inheritdoc ILabTestAttestation
    function testCount(bytes32 lotId) external view override returns (uint256) {
        return _lotTests[lotId].length;
    }

    /// @inheritdoc ILabTestAttestation
    function testAt(bytes32 lotId, uint256 index) external view override returns (LabTest memory) {
        return _tests[_lotTests[lotId][index]];
    }

    /// @inheritdoc ILabTestAttestation
    function testOf(bytes32 testId) external view override returns (LabTest memory) {
        return _tests[testId];
    }
}
