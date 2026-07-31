// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { GradingRegistry } from "../../src/commodities/GradingRegistry.sol";
import { HarvestRegistry } from "../../src/commodities/HarvestRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IGradingRegistry } from "../../src/interfaces/IGradingRegistry.sol";
import { IHarvestRegistry } from "../../src/interfaces/IHarvestRegistry.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract GradingRegistryTest is Test {
    AddressBook internal book;
    GradingRegistry internal grading;

    address internal admin = address(0xA11CE);
    address internal grader = address(0x62A);
    address internal grader2 = address(0x62B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant G1 = keccak256("grading-1");
    bytes32 internal constant G2 = keccak256("grading-2");
    bytes32 internal constant LOT = keccak256("lot-1");
    bytes32 internal constant STANDARD = keccak256("USDA");
    bytes32 internal constant GRADE_A = keccak256("A");
    bytes32 internal constant GRADE_B = keccak256("B");
    bytes32 internal constant EVIDENCE = keccak256("evidence");

    event Graded(
        bytes32 indexed gradingId,
        bytes32 indexed lotId,
        bytes32 indexed standard,
        bytes32 grade,
        uint16 score,
        address grader
    );
    event GradingRevoked(bytes32 indexed gradingId, bytes32 reason);

    function setUp() public {
        book = new AddressBook(admin);
        grading = new GradingRegistry(address(book), admin);

        vm.startPrank(admin);
        grading.grantRole(Roles.GRADER_ROLE, grader);
        grading.grantRole(Roles.GRADER_ROLE, grader2);
        vm.stopPrank();
    }

    function _grade(bytes32 id, address who) internal {
        vm.prank(who);
        grading.grade(id, LOT, STANDARD, GRADE_A, 9200, EVIDENCE);
    }

    function test_Grade_HappyPath() public {
        vm.expectEmit(true, true, true, true, address(grading));
        emit Graded(G1, LOT, STANDARD, GRADE_A, 9200, grader);

        _grade(G1, grader);

        IGradingRegistry.Grading memory g = grading.gradingOf(G1);
        assertEq(g.lotId, LOT);
        assertEq(g.grade, GRADE_A);
        assertEq(g.score, 9200);
        assertEq(g.grader, grader);
        assertFalse(g.revoked);
        assertEq(grading.latestGradingOf(LOT), G1);
        assertEq(grading.gradingCountOf(LOT), 1);
    }

    function test_RevertWhen_NonGraderGrades() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.GRADER_ROLE)
        );
        grading.grade(G1, LOT, STANDARD, GRADE_A, 9200, EVIDENCE);
    }

    function test_RevertWhen_ZeroLot() public {
        vm.prank(grader);
        vm.expectRevert(IGradingRegistry.ZeroLot.selector);
        grading.grade(G1, bytes32(0), STANDARD, GRADE_A, 9200, EVIDENCE);
    }

    function test_RevertWhen_ScoreOutOfRange() public {
        vm.prank(grader);
        vm.expectRevert(abi.encodeWithSelector(IGradingRegistry.ScoreOutOfRange.selector, uint16(10_001)));
        grading.grade(G1, LOT, STANDARD, GRADE_A, 10_001, EVIDENCE);
    }

    function test_RevertWhen_DuplicateGradingId() public {
        _grade(G1, grader);
        vm.prank(grader);
        vm.expectRevert(abi.encodeWithSelector(IGradingRegistry.GradingExists.selector, G1));
        grading.grade(G1, LOT, STANDARD, GRADE_B, 8000, EVIDENCE);
    }

    function test_Revoke_ByGrader_FallsBackToPrevious() public {
        _grade(G1, grader);
        vm.prank(grader2);
        grading.grade(G2, LOT, STANDARD, GRADE_B, 8000, EVIDENCE);
        assertEq(grading.latestGradingOf(LOT), G2);

        vm.expectEmit(true, false, false, true, address(grading));
        emit GradingRevoked(G2, keccak256("mislabel"));
        vm.prank(grader2);
        grading.revoke(G2, keccak256("mislabel"));

        assertTrue(grading.gradingOf(G2).revoked);
        // Latest falls back to the earlier, still-valid grading.
        assertEq(grading.latestGradingOf(LOT), G1);
    }

    function test_Revoke_ByAdmin() public {
        _grade(G1, grader);
        vm.prank(admin);
        grading.revoke(G1, keccak256("fraud"));
        assertTrue(grading.gradingOf(G1).revoked);
        assertEq(grading.latestGradingOf(LOT), bytes32(0));
    }

    function test_RevertWhen_RevokeByStranger() public {
        _grade(G1, grader);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IGradingRegistry.NotGrader.selector, G1));
        grading.revoke(G1, keccak256("x"));
    }

    function test_RevertWhen_RevokeTwice() public {
        _grade(G1, grader);
        vm.startPrank(grader);
        grading.revoke(G1, keccak256("x"));
        vm.expectRevert(abi.encodeWithSelector(IGradingRegistry.AlreadyRevoked.selector, G1));
        grading.revoke(G1, keccak256("y"));
        vm.stopPrank();
    }

    function test_RevertWhen_RevokeUnknown() public {
        vm.prank(grader);
        vm.expectRevert(abi.encodeWithSelector(IGradingRegistry.UnknownGrading.selector, G1));
        grading.revoke(G1, keccak256("x"));
    }

    function test_Integration_GradingAdvancesHarvestState() public {
        // Wire a real HarvestRegistry and register a harvest whose id is the graded lot.
        HarvestRegistry harvest = new HarvestRegistry(address(book), admin);
        vm.startPrank(admin);
        book.setAddress(Keys.HARVEST_REGISTRY, address(harvest));
        book.setAddress(Keys.GRADING_REGISTRY, address(grading));
        vm.stopPrank();

        address producer = address(0xA71CE);
        vm.prank(producer);
        harvest.registerHarvest(LOT, producer, keccak256("COFFEE"), bytes32(0), bytes32(0), 5000, uint64(block.timestamp), bytes32(0));

        _grade(G1, grader);

        // Grading the harvest lot transitioned it to Graded via the cross-domain call.
        assertEq(uint8(harvest.harvestOf(LOT).state), uint8(IHarvestRegistry.HarvestState.Graded));
    }
}
