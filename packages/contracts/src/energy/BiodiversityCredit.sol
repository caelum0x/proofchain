// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IBiodiversityCredit } from "../interfaces/IBiodiversityCredit.sol";

/// @title BiodiversityCredit
/// @notice Registry and ledger for biodiversity / nature credits (1 unit == 1 verified biodiversity unit
///         over a defined habitat area). A steward registers a project against a habitat, geohash and
///         methodology; a CERTIFIER verifies it with baseline + uplift measurements; a MINTER issues
///         credits against the verified uplift; holders transfer and retire to evidence a
///         no-net-loss / net-gain claim.
/// @dev Balances are scoped per `projectId`. Verification records the baseline and uplift scores and
///      caps lifetime issuance to the measured uplift, so credits can never be issued beyond the
///      ecological gain that backs them. Peer dependencies (SustainabilityOracle, ESGRegistry,
///      DPPComplianceOracle) resolve lazily through the {AddressBook}.
contract BiodiversityCredit is ProofChainAccess, IBiodiversityCredit {
    /// @dev projectId => project record.
    mapping(bytes32 => Project) private _projects;

    /// @dev projectId => account => live (unretired) credit balance.
    mapping(bytes32 => mapping(address => uint256)) private _balances;

    /// @dev projectId => verified baseline score.
    mapping(bytes32 => uint256) private _baseline;

    /// @dev projectId => verified uplift score (== max issuable credits for the project).
    mapping(bytes32 => uint256) private _uplift;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE plus the initial CERTIFIER and MINTER roles.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.CERTIFIER_ROLE, admin);
        _grantRole(Roles.MINTER_ROLE, admin);
    }

    // --------------------------------------------------------------------- project lifecycle

    /// @inheritdoc IBiodiversityCredit
    function registerProject(
        bytes32 projectId,
        address steward,
        bytes32 habitat,
        bytes32 geohash,
        bytes32 methodology,
        uint32 areaHectares
    ) external override onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        if (steward == address(0)) revert ZeroAddress();
        if (areaHectares == 0) revert ZeroArea();
        if (_projects[projectId].state != ProjectState.None) revert ProjectExists(projectId);

        _projects[projectId] = Project({
            projectId: projectId,
            steward: steward,
            habitat: habitat,
            geohash: geohash,
            methodology: methodology,
            areaHectares: areaHectares,
            issued: 0,
            retired: 0,
            state: ProjectState.Registered
        });

        emit ProjectRegistered(projectId, steward, habitat, methodology, areaHectares);
    }

    /// @inheritdoc IBiodiversityCredit
    function verifyProject(bytes32 projectId, uint256 baselineScore, uint256 upliftScore)
        external
        override
        onlyRole(Roles.CERTIFIER_ROLE)
    {
        _requireNotGloballyPaused();
        if (upliftScore == 0) revert ZeroAmount();
        Project storage p = _projects[projectId];
        _requireState(projectId, p, ProjectState.Registered);

        _baseline[projectId] = baselineScore;
        _uplift[projectId] = upliftScore;
        p.state = ProjectState.Verified;

        emit ProjectVerified(projectId, baselineScore, upliftScore);
    }

    /// @inheritdoc IBiodiversityCredit
    function suspendProject(bytes32 projectId, bytes32 reason) external override onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        Project storage p = _projects[projectId];
        if (p.state != ProjectState.Registered && p.state != ProjectState.Verified) {
            revert InvalidState(projectId, ProjectState.Verified, p.state);
        }
        p.state = ProjectState.Suspended;
        emit ProjectSuspended(projectId, reason);
    }

    // --------------------------------------------------------------------- credits

    /// @inheritdoc IBiodiversityCredit
    function issue(bytes32 projectId, address to, uint256 amount) external override onlyRole(Roles.MINTER_ROLE) {
        _requireNotGloballyPaused();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Project storage p = _projects[projectId];
        _requireState(projectId, p, ProjectState.Verified);

        uint256 remaining = _uplift[projectId] - p.issued;
        if (amount > remaining) revert UpliftExceeded(projectId, amount, remaining);

        p.issued += amount;
        _balances[projectId][to] += amount;

        emit CreditsIssued(projectId, to, amount);
    }

    /// @inheritdoc IBiodiversityCredit
    function transfer(bytes32 projectId, address to, uint256 amount) external override {
        _requireNotGloballyPaused();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Project storage p = _projects[projectId];
        _requireState(projectId, p, ProjectState.Verified);

        uint256 bal = _balances[projectId][msg.sender];
        if (bal < amount) revert InsufficientCredits(projectId, msg.sender, amount, bal);

        _balances[projectId][msg.sender] = bal - amount;
        _balances[projectId][to] += amount;

        emit CreditsTransferred(projectId, msg.sender, to, amount);
    }

    /// @inheritdoc IBiodiversityCredit
    function retire(bytes32 projectId, uint256 amount, bytes32 beneficiary) external override {
        _requireNotGloballyPaused();
        if (amount == 0) revert ZeroAmount();

        Project storage p = _projects[projectId];
        if (p.state == ProjectState.None) revert UnknownProject(projectId);

        uint256 bal = _balances[projectId][msg.sender];
        if (bal < amount) revert InsufficientCredits(projectId, msg.sender, amount, bal);

        _balances[projectId][msg.sender] = bal - amount;
        p.retired += amount;

        emit CreditsRetired(projectId, msg.sender, amount, beneficiary);
    }

    // --------------------------------------------------------------------- views

    /// @inheritdoc IBiodiversityCredit
    function balanceOf(bytes32 projectId, address account) external view override returns (uint256) {
        return _balances[projectId][account];
    }

    /// @inheritdoc IBiodiversityCredit
    function projectOf(bytes32 projectId) external view override returns (Project memory) {
        if (_projects[projectId].state == ProjectState.None) revert UnknownProject(projectId);
        return _projects[projectId];
    }

    /// @notice Verified baseline and uplift scores for a project (uplift == max issuable credits).
    function scoresOf(bytes32 projectId) external view returns (uint256 baselineScore, uint256 upliftScore) {
        if (_projects[projectId].state == ProjectState.None) revert UnknownProject(projectId);
        return (_baseline[projectId], _uplift[projectId]);
    }

    // --------------------------------------------------------------------- internal

    /// @dev Require a project to exist and be in `expected` state.
    function _requireState(bytes32 projectId, Project storage p, ProjectState expected) private view {
        if (p.state == ProjectState.None) revert UnknownProject(projectId);
        if (p.state != expected) revert InvalidState(projectId, expected, p.state);
    }
}
