// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { IOrganizationRegistry } from "../interfaces/IOrganizationRegistry.sol";
import { IAddressBook } from "../interfaces/IAddressBook.sol";
import { IPauser } from "../interfaces/IPauser.sol";
import { Keys } from "../core/Keys.sol";

/// @title OrganizationRegistry
/// @notice Registry of organizations (suppliers/buyers/carriers/lenders/insurers) with a
///         per-org admin and a member set. Registration is permissionless self-service: the
///         caller becomes the org admin and its first member.
/// @dev Does NOT inherit {ProofChainAccess} because {IOrganizationRegistry} declares its own
///      `ZeroAddress` error, which would collide with the base's. It still resolves the global
///      {Pauser} through the {AddressBook} for parity with the rest of the platform.
contract OrganizationRegistry is AccessControl, IOrganizationRegistry {
    /// @notice The shared service registry used to resolve the optional global {Pauser}.
    IAddressBook public immutable addressBook;

    mapping(bytes32 => Organization) private _orgs;
    mapping(bytes32 => mapping(address => bool)) private _members;
    mapping(address => bytes32) private _orgOfMember;

    /// @param addressBook_ Deployed {AddressBook} (used for global-pause resolution).
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) {
        if (addressBook_ == address(0) || admin == address(0)) revert ZeroAddress();
        addressBook = IAddressBook(addressBook_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @inheritdoc IOrganizationRegistry
    function registerOrg(bytes32 orgId, string calldata name, OrgType orgType, string calldata metadataURI)
        external
    {
        _requireNotGloballyPaused();
        if (orgId == bytes32(0)) revert UnknownOrg(orgId);
        if (bytes(name).length == 0) revert EmptyName();
        if (_orgs[orgId].exists) revert OrgExists(orgId);

        _orgs[orgId] = Organization({
            orgId: orgId,
            name: name,
            orgType: orgType,
            metadataURI: metadataURI,
            admin: msg.sender,
            createdAt: uint64(block.timestamp),
            exists: true
        });

        emit OrgRegistered(orgId, name, orgType, msg.sender);

        // The creating admin is enrolled as the first member.
        _members[orgId][msg.sender] = true;
        _orgOfMember[msg.sender] = orgId;
        emit MemberAdded(orgId, msg.sender);
    }

    /// @inheritdoc IOrganizationRegistry
    function addMember(bytes32 orgId, address member) external {
        _requireNotGloballyPaused();
        if (member == address(0)) revert ZeroAddress();
        Organization storage org = _orgs[orgId];
        if (!org.exists) revert UnknownOrg(orgId);
        _requireOrgAdmin(org.admin, orgId);

        if (!_members[orgId][member]) {
            _members[orgId][member] = true;
            _orgOfMember[member] = orgId;
            emit MemberAdded(orgId, member);
        }
    }

    /// @inheritdoc IOrganizationRegistry
    function removeMember(bytes32 orgId, address member) external {
        _requireNotGloballyPaused();
        if (member == address(0)) revert ZeroAddress();
        Organization storage org = _orgs[orgId];
        if (!org.exists) revert UnknownOrg(orgId);
        _requireOrgAdmin(org.admin, orgId);

        if (_members[orgId][member]) {
            _members[orgId][member] = false;
            if (_orgOfMember[member] == orgId) {
                _orgOfMember[member] = bytes32(0);
            }
            emit MemberRemoved(orgId, member);
        }
    }

    /// @inheritdoc IOrganizationRegistry
    function orgOf(bytes32 orgId) external view returns (Organization memory) {
        return _orgs[orgId];
    }

    /// @inheritdoc IOrganizationRegistry
    function isMember(bytes32 orgId, address account) external view returns (bool) {
        return _members[orgId][account];
    }

    /// @inheritdoc IOrganizationRegistry
    function orgOfMember(address account) external view returns (bytes32) {
        return _orgOfMember[account];
    }

    /// @notice Convenience existence check.
    function orgExists(bytes32 orgId) external view returns (bool) {
        return _orgs[orgId].exists;
    }

    /// @dev Only the org's own admin, or a platform DEFAULT_ADMIN_ROLE holder, may manage members.
    function _requireOrgAdmin(address orgAdmin, bytes32 orgId) private view {
        if (msg.sender != orgAdmin && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotOrgAdmin(orgId);
        }
    }

    /// @dev Reverts if the optional global {Pauser} is wired and currently paused.
    function _requireNotGloballyPaused() private view {
        address pauser = addressBook.getAddress(Keys.PAUSER);
        if (pauser != address(0)) {
            IPauser(pauser).requireNotPaused();
        }
    }
}
