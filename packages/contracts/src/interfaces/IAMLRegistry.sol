// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IAMLRegistry
/// @notice Anti-money-laundering risk register. Compliance officers assign a per-account risk rating and
///         may raise Suspicious Activity Reports (SARs) against transactions. Downstream modules gate
///         high-risk or SAR-flagged parties from settlement/financing.
/// @dev deps (AddressBook): KYCRegistry, SanctionsScreening.
interface IAMLRegistry {
    enum RiskRating {
        Unrated,
        Low,
        Medium,
        High,
        Prohibited
    }

    struct RiskProfile {
        RiskRating rating;
        uint64 updatedAt;
        bytes32 evidenceHash;
        uint32 openSARs;
    }

    event RiskRated(address indexed account, RiskRating rating, bytes32 evidenceHash);
    event SARFiled(bytes32 indexed sarId, address indexed subject, bytes32 detailsHash);
    event SARResolved(bytes32 indexed sarId, bool escalated);

    error InvalidRating();
    error SARExists(bytes32 sarId);
    error UnknownSAR(bytes32 sarId);

    /// @notice Set an account's AML risk rating. COMPLIANCE_OFFICER_ROLE only.
    function setRisk(address account, RiskRating rating, bytes32 evidenceHash) external;

    /// @notice File a suspicious activity report against a subject.
    function fileSAR(bytes32 sarId, address subject, bytes32 detailsHash) external;

    /// @notice Resolve an open SAR, optionally escalating it.
    function resolveSAR(bytes32 sarId, bool escalated) external;

    /// @notice Current risk rating for an account (Unrated if never set).
    function riskOf(address account) external view returns (RiskRating);

    /// @notice True if the account is High/Prohibited or has open SARs.
    function isHighRisk(address account) external view returns (bool);

    function profileOf(address account) external view returns (RiskProfile memory);
}
