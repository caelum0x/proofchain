// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { SanctionsScreening } from "../../src/compliance/SanctionsScreening.sol";
import { ISanctionsScreening } from "../../src/interfaces/ISanctionsScreening.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract SanctionsScreeningTest is Test {
    AddressBook internal book;
    SanctionsScreening internal sanctions;

    address internal admin = address(0xA11CE);
    address internal officer = address(0x0FF1CE);
    address internal stranger = address(0xDEAD);
    address internal badActor = address(0xBAD);

    bytes32 internal constant ENTITY = keccak256("acme-holdings");
    bytes32 internal constant REASON = keccak256("ofac-sdn-12345");

    event AddressListed(address indexed account, ISanctionsScreening.ListSource source, bytes32 reasonHash);
    event AddressCleared(address indexed account);
    event EntityListed(bytes32 indexed entityHash, ISanctionsScreening.ListSource source, bytes32 reasonHash);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        sanctions = new SanctionsScreening(address(book), admin);
        sanctions.grantRole(Roles.COMPLIANCE_OFFICER_ROLE, officer);
        vm.stopPrank();
    }

    function test_ListAddress_Happy() public {
        vm.expectEmit(true, false, false, true);
        emit AddressListed(badActor, ISanctionsScreening.ListSource.OFAC, REASON);
        vm.prank(officer);
        sanctions.listAddress(badActor, ISanctionsScreening.ListSource.OFAC, REASON);

        assertTrue(sanctions.isSanctioned(badActor));
        ISanctionsScreening.SanctionEntry memory e = sanctions.entryOf(badActor);
        assertTrue(e.blocked);
        assertEq(uint8(e.source), uint8(ISanctionsScreening.ListSource.OFAC));
        assertEq(e.reasonHash, REASON);
        assertGt(e.addedAt, 0);
    }

    function test_ClearAddress_Happy() public {
        vm.startPrank(officer);
        sanctions.listAddress(badActor, ISanctionsScreening.ListSource.EU, REASON);
        vm.expectEmit(true, false, false, false);
        emit AddressCleared(badActor);
        sanctions.clearAddress(badActor);
        vm.stopPrank();

        assertFalse(sanctions.isSanctioned(badActor));
        assertGt(sanctions.entryOf(badActor).clearedAt, 0);
    }

    function test_ListEntity_Happy() public {
        vm.expectEmit(true, false, false, true);
        emit EntityListed(ENTITY, ISanctionsScreening.ListSource.UN, REASON);
        vm.prank(officer);
        sanctions.listEntity(ENTITY, ISanctionsScreening.ListSource.UN, REASON);

        assertTrue(sanctions.isEntitySanctioned(ENTITY));
        assertTrue(sanctions.entityEntryOf(ENTITY).blocked);
    }

    function test_ClearEntity_Happy() public {
        vm.startPrank(officer);
        sanctions.listEntity(ENTITY, ISanctionsScreening.ListSource.UN, REASON);
        sanctions.clearEntity(ENTITY);
        vm.stopPrank();
        assertFalse(sanctions.isEntitySanctioned(ENTITY));
    }

    function test_Revert_ListAddress_AlreadyListed() public {
        vm.startPrank(officer);
        sanctions.listAddress(badActor, ISanctionsScreening.ListSource.OFAC, REASON);
        vm.expectRevert(ISanctionsScreening.AlreadyListed.selector);
        sanctions.listAddress(badActor, ISanctionsScreening.ListSource.OFAC, REASON);
        vm.stopPrank();
    }

    function test_Revert_ClearAddress_NotListed() public {
        vm.prank(officer);
        vm.expectRevert(ISanctionsScreening.NotListed.selector);
        sanctions.clearAddress(badActor);
    }

    function test_Revert_ListAddress_ZeroAddress() public {
        vm.prank(officer);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        sanctions.listAddress(address(0), ISanctionsScreening.ListSource.OFAC, REASON);
    }

    function test_Revert_ListEntity_ZeroEntity() public {
        vm.prank(officer);
        vm.expectRevert(ISanctionsScreening.ZeroEntity.selector);
        sanctions.listEntity(bytes32(0), ISanctionsScreening.ListSource.OFAC, REASON);
    }

    function test_Revert_ListAddress_AccessControl() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.COMPLIANCE_OFFICER_ROLE
            )
        );
        sanctions.listAddress(badActor, ISanctionsScreening.ListSource.OFAC, REASON);
    }
}
