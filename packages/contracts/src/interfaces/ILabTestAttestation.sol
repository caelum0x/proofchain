// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ILabTestAttestation
/// @notice Accredited laboratories attest analytical test results for a sample drawn from a batch/lot (e.g.
///         pesticide residue, moisture, heavy metals, microbiology). Each result records the measured value
///         against a spec limit and a pass/fail, forming a tamper-evident certificate of analysis on-chain.
/// @dev deps (AddressBook): ProvenanceRegistry, QualityInspection, AttestationRegistry, IdentityResolver.
interface ILabTestAttestation {
    enum Result {
        Pending,
        Pass,
        Fail,
        Inconclusive
    }

    struct LabTest {
        bytes32 testId;
        bytes32 lotId;
        bytes32 sampleId;
        address lab;
        bytes32 analyte;
        bytes32 method;
        int256 measuredValue;
        int256 limitValue;
        uint8 decimals;
        Result result;
        bytes32 reportHash;
        uint64 testedAt;
        bool revoked;
    }

    event LabTestAttested(
        bytes32 indexed testId, bytes32 indexed lotId, address indexed lab, bytes32 analyte, Result result
    );
    event LabTestRevoked(bytes32 indexed testId, bytes32 reason);

    error TestExists(bytes32 testId);
    error UnknownTest(bytes32 testId);
    error NotLab(bytes32 testId);
    error AlreadyRevoked(bytes32 testId);
    error ZeroLot();

    /// @notice Attest a lab test result for a sample. INSPECTOR_ROLE / accredited lab.
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
    ) external;

    /// @notice Revoke a lab test attestation (error/fraud). Issuing lab / INSPECTOR_ROLE admin.
    function revoke(bytes32 testId, bytes32 reason) external;

    /// @notice True if every non-revoked test recorded for the lot passed (and at least one exists).
    function allTestsPassing(bytes32 lotId) external view returns (bool);

    /// @notice Number of tests recorded for a lot.
    function testCount(bytes32 lotId) external view returns (uint256);

    function testAt(bytes32 lotId, uint256 index) external view returns (LabTest memory);
    function testOf(bytes32 testId) external view returns (LabTest memory);
}
