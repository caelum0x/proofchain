// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Pauser } from "../../src/core/Pauser.sol";
import { Keys } from "../../src/core/Keys.sol";
import { OrganizationRegistry } from "../../src/identity/OrganizationRegistry.sol";
import { IOrganizationRegistry } from "../../src/interfaces/IOrganizationRegistry.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";

contract OrganizationRegistryTest is Test {
    AddressBook internal book;
    OrganizationRegistry internal reg;

    address internal admin = address(0xA11CE);
    address internal creator = address(0xC0FFEE);
    address internal member = address(0xBEEF);
    address internal stranger = address(0xD00D);

    bytes32 internal constant ORG = keccak256("acme-corp");

    event OrgRegistered(bytes32 indexed orgId, string name, IOrganizationRegistry.OrgType orgType, address indexed admin);
    event MemberAdded(bytes32 indexed orgId, address indexed member);
    event MemberRemoved(bytes32 indexed orgId, address indexed member);

    function setUp() public {
        book = new AddressBook(admin);
        reg = new OrganizationRegistry(address(book), admin);
    }

    function _register() internal {
        vm.prank(creator);
        reg.registerOrg(ORG, "Acme", IOrganizationRegistry.OrgType.Supplier, "ipfs://meta");
    }

    function test_Constructor_RevertsZeroAddressBook() public {
        vm.expectRevert(IOrganizationRegistry.ZeroAddress.selector);
        new OrganizationRegistry(address(0), admin);
    }

    function test_Constructor_RevertsZeroAdmin() public {
        vm.expectRevert(IOrganizationRegistry.ZeroAddress.selector);
        new OrganizationRegistry(address(book), address(0));
    }

    function test_RegisterOrg_StoresEmitsAndEnrollsCreator() public {
        vm.expectEmit(true, true, true, true);
        emit OrgRegistered(ORG, "Acme", IOrganizationRegistry.OrgType.Supplier, creator);
        vm.expectEmit(true, true, true, true);
        emit MemberAdded(ORG, creator);
        _register();

        IOrganizationRegistry.Organization memory org = reg.orgOf(ORG);
        assertEq(org.orgId, ORG);
        assertEq(org.name, "Acme");
        assertEq(uint8(org.orgType), uint8(IOrganizationRegistry.OrgType.Supplier));
        assertEq(org.metadataURI, "ipfs://meta");
        assertEq(org.admin, creator);
        assertTrue(org.exists);
        assertEq(org.createdAt, uint64(block.timestamp));

        assertTrue(reg.isMember(ORG, creator));
        assertEq(reg.orgOfMember(creator), ORG);
        assertTrue(reg.orgExists(ORG));
    }

    function test_RegisterOrg_RevertsOnDuplicate() public {
        _register();
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(IOrganizationRegistry.OrgExists.selector, ORG));
        reg.registerOrg(ORG, "Acme2", IOrganizationRegistry.OrgType.Buyer, "ipfs://x");
    }

    function test_RegisterOrg_RevertsEmptyName() public {
        vm.prank(creator);
        vm.expectRevert(IOrganizationRegistry.EmptyName.selector);
        reg.registerOrg(ORG, "", IOrganizationRegistry.OrgType.Supplier, "ipfs://x");
    }

    function test_RegisterOrg_RevertsZeroOrgId() public {
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(IOrganizationRegistry.UnknownOrg.selector, bytes32(0)));
        reg.registerOrg(bytes32(0), "Acme", IOrganizationRegistry.OrgType.Supplier, "ipfs://x");
    }

    function test_AddMember_ByOrgAdmin() public {
        _register();
        vm.expectEmit(true, true, true, true);
        emit MemberAdded(ORG, member);
        vm.prank(creator);
        reg.addMember(ORG, member);

        assertTrue(reg.isMember(ORG, member));
        assertEq(reg.orgOfMember(member), ORG);
    }

    function test_AddMember_ByPlatformAdminOverride() public {
        _register();
        // `admin` holds DEFAULT_ADMIN_ROLE and may manage any org's members.
        vm.prank(admin);
        reg.addMember(ORG, member);
        assertTrue(reg.isMember(ORG, member));
    }

    function test_AddMember_Idempotent() public {
        _register();
        vm.startPrank(creator);
        reg.addMember(ORG, member);
        reg.addMember(ORG, member); // no revert, no double-enroll issue
        vm.stopPrank();
        assertTrue(reg.isMember(ORG, member));
    }

    function test_AddMember_RevertsUnknownOrg() public {
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(IOrganizationRegistry.UnknownOrg.selector, ORG));
        reg.addMember(ORG, member);
    }

    function test_AddMember_RevertsZeroAddress() public {
        _register();
        vm.prank(creator);
        vm.expectRevert(IOrganizationRegistry.ZeroAddress.selector);
        reg.addMember(ORG, address(0));
    }

    function test_AddMember_RevertsNotOrgAdmin() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IOrganizationRegistry.NotOrgAdmin.selector, ORG));
        reg.addMember(ORG, member);
    }

    function test_RemoveMember_ClearsAndEmits() public {
        _register();
        vm.startPrank(creator);
        reg.addMember(ORG, member);
        vm.expectEmit(true, true, true, true);
        emit MemberRemoved(ORG, member);
        reg.removeMember(ORG, member);
        vm.stopPrank();

        assertFalse(reg.isMember(ORG, member));
        assertEq(reg.orgOfMember(member), bytes32(0));
    }

    function test_RemoveMember_RevertsNotOrgAdmin() public {
        _register();
        vm.prank(creator);
        reg.addMember(ORG, member);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IOrganizationRegistry.NotOrgAdmin.selector, ORG));
        reg.removeMember(ORG, member);
    }

    function test_GlobalPause_BlocksRegister() public {
        Pauser pauser = new Pauser(admin);
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.prank(creator);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        reg.registerOrg(ORG, "Acme", IOrganizationRegistry.OrgType.Supplier, "ipfs://meta");
    }
}
