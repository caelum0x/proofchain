// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IWaterCredit } from "../interfaces/IWaterCredit.sol";

/// @title WaterCredit
/// @notice Registry and ledger for water restoration / conservation credits (1 unit == 1 m3 of verified
///         water benefit). A steward registers a project against a basin + methodology; a CERTIFIER
///         verifies it; a MINTER issues credits against measured volumetric benefit; holders transfer
///         and permanently retire credits to make a water-stewardship claim.
/// @dev Balances are scoped per `projectId` so credits from distinct projects never fungibly mix.
///      Issuance requires a Verified project; a Suspended project (fraud/reversal) blocks issuance and
///      transfers but still lets holders retire. Peer dependencies (SustainabilityOracle, ESGRegistry,
///      IoTSensorRegistry) resolve lazily through the {AddressBook}.
contract WaterCredit is ProofChainAccess, IWaterCredit {
    /// @dev projectId => project record.
    mapping(bytes32 => Project) private _projects;

    /// @dev projectId => account => live (unretired) credit balance.
    mapping(bytes32 => mapping(address => uint256)) private _balances;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE plus the initial CERTIFIER and MINTER roles.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.CERTIFIER_ROLE, admin);
        _grantRole(Roles.MINTER_ROLE, admin);
    }

    // --------------------------------------------------------------------- project lifecycle

    /// @inheritdoc IWaterCredit
    function registerProject(bytes32 projectId, address steward, bytes32 basin, bytes32 methodology)
        external
        override
        onlyRole(Roles.CERTIFIER_ROLE)
    {
        _requireNotGloballyPaused();
        if (steward == address(0)) revert ZeroAddress();
        if (_projects[projectId].state != ProjectState.None) revert ProjectExists(projectId);

        _projects[projectId] = Project({
            projectId: projectId,
            steward: steward,
            basin: basin,
            methodology: methodology,
            issued: 0,
            retired: 0,
            state: ProjectState.Registered
        });

        emit ProjectRegistered(projectId, steward, basin, methodology);
    }

    /// @inheritdoc IWaterCredit
    function verifyProject(bytes32 projectId) external override onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        Project storage p = _projects[projectId];
        _requireState(projectId, p, ProjectState.Registered);
        p.state = ProjectState.Verified;
        emit ProjectVerified(projectId);
    }

    /// @inheritdoc IWaterCredit
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

    /// @inheritdoc IWaterCredit
    function issue(bytes32 projectId, address to, uint256 amount) external override onlyRole(Roles.MINTER_ROLE) {
        _requireNotGloballyPaused();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Project storage p = _projects[projectId];
        _requireState(projectId, p, ProjectState.Verified);

        p.issued += amount;
        _balances[projectId][to] += amount;

        emit CreditsIssued(projectId, to, amount);
    }

    /// @inheritdoc IWaterCredit
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

    /// @inheritdoc IWaterCredit
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

    /// @inheritdoc IWaterCredit
    function balanceOf(bytes32 projectId, address account) external view override returns (uint256) {
        return _balances[projectId][account];
    }

    /// @inheritdoc IWaterCredit
    function projectOf(bytes32 projectId) external view override returns (Project memory) {
        if (_projects[projectId].state == ProjectState.None) revert UnknownProject(projectId);
        return _projects[projectId];
    }

    // --------------------------------------------------------------------- internal

    /// @dev Require a project to exist and be in `expected` state.
    function _requireState(bytes32 projectId, Project storage p, ProjectState expected) private view {
        if (p.state == ProjectState.None) revert UnknownProject(projectId);
        if (p.state != expected) revert InvalidState(projectId, expected, p.state);
    }
}
