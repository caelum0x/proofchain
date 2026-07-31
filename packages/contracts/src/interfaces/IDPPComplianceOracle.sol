// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IDPPComplianceOracle
/// @notice AI/attestation-driven DPP completeness and regulatory conformance oracle. For each passport it
///         records a compliance score, the set of satisfied requirement flags, and a pass/fail verdict
///         against a named regulation profile (e.g. ESPR, battery regulation). Gates passport activation.
/// @dev deps (AddressBook): DigitalProductPassport, MaterialComposition, RepairabilityIndex, AttestationRegistry.
interface IDPPComplianceOracle {
    enum Verdict {
        Pending,
        Compliant,
        NonCompliant,
        Conditional
    }

    struct ComplianceReport {
        uint256 tokenId;
        bytes32 regulationProfile;
        uint16 score;
        uint32 satisfiedFlags;
        uint32 requiredFlags;
        Verdict verdict;
        bytes32 evidenceHash;
        uint64 evaluatedAt;
    }

    event ProfileConfigured(bytes32 indexed regulationProfile, uint32 requiredFlags, uint16 minScore);
    event Evaluated(uint256 indexed tokenId, bytes32 indexed regulationProfile, uint16 score, Verdict verdict);

    error UnknownPassport(uint256 tokenId);
    error UnknownProfile(bytes32 regulationProfile);
    error ScoreOutOfRange(uint16 score);

    /// @notice Configure a regulation profile's required flags and minimum score. GOVERNOR_ROLE only.
    function configureProfile(bytes32 regulationProfile, uint32 requiredFlags, uint16 minScore) external;

    /// @notice Record an AI-verified compliance evaluation for a passport. AGENT_ROLE only.
    /// @return verdict The resulting verdict.
    function evaluate(uint256 tokenId, bytes32 regulationProfile, uint16 score, uint32 satisfiedFlags, bytes32 evidenceHash)
        external
        returns (Verdict verdict);

    /// @notice True if the latest report for a passport/profile is Compliant.
    function isCompliant(uint256 tokenId, bytes32 regulationProfile) external view returns (bool);

    function reportOf(uint256 tokenId, bytes32 regulationProfile) external view returns (ComplianceReport memory);
}
