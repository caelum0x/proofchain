// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IBiodiversityCredit
/// @notice Registry and ledger for biodiversity / nature credits (1 unit == 1 verified biodiversity unit over
///         a defined habitat area). Projects are registered against a habitat and methodology, verified with a
///         baseline + uplift measurement, issued credits, and retired to evidence a no-net-loss / net-gain claim.
/// @dev deps (AddressBook): SustainabilityOracle, ESGRegistry, DPPComplianceOracle.
interface IBiodiversityCredit {
    enum ProjectState {
        None,
        Registered,
        Verified,
        Suspended
    }

    struct Project {
        bytes32 projectId;
        address steward;
        bytes32 habitat;
        bytes32 geohash;
        bytes32 methodology;
        uint32 areaHectares;
        uint256 issued;
        uint256 retired;
        ProjectState state;
    }

    event ProjectRegistered(
        bytes32 indexed projectId, address indexed steward, bytes32 habitat, bytes32 methodology, uint32 areaHectares
    );
    event ProjectVerified(bytes32 indexed projectId, uint256 baselineScore, uint256 upliftScore);
    event ProjectSuspended(bytes32 indexed projectId, bytes32 reason);
    event CreditsIssued(bytes32 indexed projectId, address indexed to, uint256 amount);
    event CreditsTransferred(bytes32 indexed projectId, address indexed from, address indexed to, uint256 amount);
    event CreditsRetired(bytes32 indexed projectId, address indexed account, uint256 amount, bytes32 beneficiary);

    error ProjectExists(bytes32 projectId);
    error UnknownProject(bytes32 projectId);
    error InvalidState(bytes32 projectId, ProjectState expected, ProjectState actual);
    error InsufficientCredits(bytes32 projectId, address account, uint256 requested, uint256 available);
    error ZeroAmount();
    error ZeroArea();
    /// @notice Issuing more credits than the verified uplift backing the project.
    error UpliftExceeded(bytes32 projectId, uint256 requested, uint256 remaining);

    /// @notice Register a biodiversity project. CERTIFIER_ROLE / steward.
    function registerProject(
        bytes32 projectId,
        address steward,
        bytes32 habitat,
        bytes32 geohash,
        bytes32 methodology,
        uint32 areaHectares
    ) external;

    /// @notice Verify with baseline and uplift scores, enabling issuance. CERTIFIER_ROLE only.
    function verifyProject(bytes32 projectId, uint256 baselineScore, uint256 upliftScore) external;

    /// @notice Suspend a project (reversal/fraud). CERTIFIER_ROLE only.
    function suspendProject(bytes32 projectId, bytes32 reason) external;

    /// @notice Issue credits against verified uplift. MINTER_ROLE only.
    function issue(bytes32 projectId, address to, uint256 amount) external;

    /// @notice Transfer credits to another account within a project.
    function transfer(bytes32 projectId, address to, uint256 amount) external;

    /// @notice Permanently retire credits and record the claiming beneficiary.
    function retire(bytes32 projectId, uint256 amount, bytes32 beneficiary) external;

    function balanceOf(bytes32 projectId, address account) external view returns (uint256);
    function projectOf(bytes32 projectId) external view returns (Project memory);
}
