// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IOrganizationRegistry
/// @notice Registry of organizations that suppliers/buyers/carriers belong to.
interface IOrganizationRegistry {
    enum OrgType {
        Unknown,
        Supplier,
        Buyer,
        Carrier,
        Lender,
        Insurer,
        Other
    }

    struct Organization {
        bytes32 orgId;
        string name;
        OrgType orgType;
        string metadataURI;
        address admin;
        uint64 createdAt;
        bool exists;
    }

    event OrgRegistered(bytes32 indexed orgId, string name, OrgType orgType, address indexed admin);
    event MemberAdded(bytes32 indexed orgId, address indexed member);
    event MemberRemoved(bytes32 indexed orgId, address indexed member);

    error OrgExists(bytes32 orgId);
    error UnknownOrg(bytes32 orgId);
    error NotOrgAdmin(bytes32 orgId);
    error EmptyName();
    error ZeroAddress();

    function registerOrg(bytes32 orgId, string calldata name, OrgType orgType, string calldata metadataURI) external;
    function addMember(bytes32 orgId, address member) external;
    function removeMember(bytes32 orgId, address member) external;

    function orgOf(bytes32 orgId) external view returns (Organization memory);
    function isMember(bytes32 orgId, address account) external view returns (bool);
    function orgOfMember(address account) external view returns (bytes32);
}
