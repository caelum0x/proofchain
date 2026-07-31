// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IWaterCredit
/// @notice Registry and ledger for water restoration / conservation credits (1 unit == 1 m3 of verified water
///         benefit). A project is registered and verified, credits are issued against measured volumetric
///         benefit, transferred between accounts, and permanently retired to make a water-stewardship claim.
/// @dev deps (AddressBook): SustainabilityOracle, ESGRegistry, IoTSensorRegistry.
interface IWaterCredit {
    enum ProjectState {
        None,
        Registered,
        Verified,
        Suspended
    }

    struct Project {
        bytes32 projectId;
        address steward;
        bytes32 basin;
        bytes32 methodology;
        uint256 issued;
        uint256 retired;
        ProjectState state;
    }

    event ProjectRegistered(bytes32 indexed projectId, address indexed steward, bytes32 basin, bytes32 methodology);
    event ProjectVerified(bytes32 indexed projectId);
    event ProjectSuspended(bytes32 indexed projectId, bytes32 reason);
    event CreditsIssued(bytes32 indexed projectId, address indexed to, uint256 amount);
    event CreditsTransferred(bytes32 indexed projectId, address indexed from, address indexed to, uint256 amount);
    event CreditsRetired(bytes32 indexed projectId, address indexed account, uint256 amount, bytes32 beneficiary);

    error ProjectExists(bytes32 projectId);
    error UnknownProject(bytes32 projectId);
    error InvalidState(bytes32 projectId, ProjectState expected, ProjectState actual);
    error InsufficientCredits(bytes32 projectId, address account, uint256 requested, uint256 available);
    error ZeroAmount();

    /// @notice Register a water project. CERTIFIER_ROLE / steward.
    function registerProject(bytes32 projectId, address steward, bytes32 basin, bytes32 methodology) external;

    /// @notice Verify a registered project, enabling issuance. CERTIFIER_ROLE only.
    function verifyProject(bytes32 projectId) external;

    /// @notice Suspend a project (fraud/reversal). CERTIFIER_ROLE only.
    function suspendProject(bytes32 projectId, bytes32 reason) external;

    /// @notice Issue credits against verified volumetric benefit. MINTER_ROLE only.
    function issue(bytes32 projectId, address to, uint256 amount) external;

    /// @notice Transfer credits to another account within a project.
    function transfer(bytes32 projectId, address to, uint256 amount) external;

    /// @notice Permanently retire credits and record the claiming beneficiary.
    function retire(bytes32 projectId, uint256 amount, bytes32 beneficiary) external;

    function balanceOf(bytes32 projectId, address account) external view returns (uint256);
    function projectOf(bytes32 projectId) external view returns (Project memory);
}
