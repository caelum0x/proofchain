// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { ESGRegistry } from "../../src/esg/ESGRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IESGRegistry } from "../../src/interfaces/IESGRegistry.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract ESGRegistryTest is Test {
    AddressBook internal book;
    ESGRegistry internal esg;

    address internal admin = address(0xA11CE);
    address internal attestor = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant SUBJECT = keccak256("batch-1");

    event EsgSet(bytes32 indexed subject, uint16 score, string uri, address indexed attestor);

    function setUp() public {
        book = new AddressBook(admin);
        esg = new ESGRegistry(address(book), admin);

        vm.prank(admin);
        esg.grantRole(Roles.AGENT_ROLE, attestor);
    }

    function test_AdminIsAttestor() public view {
        assertTrue(esg.hasRole(Roles.AGENT_ROLE, admin));
    }

    function test_SetEsg_HappyPath() public {
        vm.expectEmit(true, true, false, true, address(esg));
        emit EsgSet(SUBJECT, 8500, "ipfs://esg", attestor);

        vm.prank(attestor);
        esg.setEsg(SUBJECT, 8500, "ipfs://esg");

        IESGRegistry.EsgRecord memory r = esg.esgOf(SUBJECT);
        assertEq(r.subject, SUBJECT);
        assertEq(r.score, 8500);
        assertEq(r.uri, "ipfs://esg");
        assertEq(r.attestor, attestor);
        assertEq(r.updatedAt, uint64(block.timestamp));
        assertTrue(r.exists);
        assertEq(esg.scoreOf(SUBJECT), 8500);
    }

    function test_SetEsg_MaxScoreAllowed() public {
        vm.prank(attestor);
        esg.setEsg(SUBJECT, 10000, "ipfs://esg");
        assertEq(esg.scoreOf(SUBJECT), 10000);
    }

    function test_SetEsg_OverwritesPrevious() public {
        vm.startPrank(attestor);
        esg.setEsg(SUBJECT, 5000, "ipfs://old");
        esg.setEsg(SUBJECT, 9000, "ipfs://new");
        vm.stopPrank();

        IESGRegistry.EsgRecord memory r = esg.esgOf(SUBJECT);
        assertEq(r.score, 9000);
        assertEq(r.uri, "ipfs://new");
    }

    function test_RevertWhen_ScoreTooHigh() public {
        vm.prank(attestor);
        vm.expectRevert(abi.encodeWithSelector(IESGRegistry.InvalidScore.selector, uint16(10001)));
        esg.setEsg(SUBJECT, 10001, "ipfs://esg");
    }

    function test_RevertWhen_EmptyURI() public {
        vm.prank(attestor);
        vm.expectRevert(IESGRegistry.EmptyURI.selector);
        esg.setEsg(SUBJECT, 8500, "");
    }

    function test_RevertWhen_NonAttestorSets() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.AGENT_ROLE)
        );
        esg.setEsg(SUBJECT, 8500, "ipfs://esg");
    }

    function test_UnsetSubject_ReturnsZero() public view {
        assertEq(esg.scoreOf(keccak256("never")), 0);
        assertFalse(esg.esgOf(keccak256("never")).exists);
    }
}
