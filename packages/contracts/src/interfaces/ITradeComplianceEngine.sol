// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ITradeComplianceEngine
/// @notice Aggregates the compliance signals required to clear a shipment: sanctions screening of the
///         parties, AML risk, required certificates/licenses, and customs status. Produces a single
///         deterministic clearance decision that finance/logistics modules gate on.
/// @dev deps (AddressBook): SanctionsScreening, AMLRegistry, ExportLicenseRegistry, CertificateOfOrigin,
///      CustomsDeclaration.
interface ITradeComplianceEngine {
    enum Decision {
        Pending,
        Cleared,
        Blocked,
        NeedsReview
    }

    struct Check {
        bytes32 batchId;
        address exporter;
        address importer;
        bytes32 destinationCountry;
        Decision decision;
        uint32 failedFlags;
        uint64 evaluatedAt;
    }

    /// @dev Bit flags for `failedFlags` in a {Check}.
    // 1<<0 sanctions, 1<<1 aml, 1<<2 license, 1<<3 certificate, 1<<4 customs.

    event Evaluated(bytes32 indexed batchId, Decision decision, uint32 failedFlags);
    event Overridden(bytes32 indexed batchId, Decision decision, string reason);
    event RequirementSet(bytes32 indexed destinationCountry, uint32 requiredFlags);

    error UnknownCheck(bytes32 batchId);
    error ZeroCountry();

    /// @notice Configure which checks are mandatory for a destination country. COMPLIANCE_OFFICER_ROLE only.
    function setRequirements(bytes32 destinationCountry, uint32 requiredFlags) external;

    /// @notice Run all configured checks for a shipment and record the decision.
    function evaluate(bytes32 batchId, address exporter, address importer, bytes32 destinationCountry)
        external
        returns (Decision decision);

    /// @notice Manually override a decision with an audit reason. COMPLIANCE_OFFICER_ROLE only.
    function override_(bytes32 batchId, Decision decision, string calldata reason) external;

    /// @notice True if the batch is currently Cleared.
    function isCleared(bytes32 batchId) external view returns (bool);

    function checkOf(bytes32 batchId) external view returns (Check memory);
}
