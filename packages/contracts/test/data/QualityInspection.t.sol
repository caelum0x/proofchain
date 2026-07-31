// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { QualityInspection } from "../../src/data/QualityInspection.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IQualityInspection } from "../../src/interfaces/IQualityInspection.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract QualityInspectionTest is Test {
    AddressBook internal book;
    QualityInspection internal qi;

    address internal admin = address(0xA11CE);
    address internal inspector = address(0x1495);
    address internal inspector2 = address(0x1496);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant I1 = keccak256("insp-1");
    bytes32 internal constant I2 = keccak256("insp-2");
    bytes32 internal constant LOT = keccak256("lot-1");
    bytes32 internal constant STD = keccak256("AQL-2.5");
    bytes32 internal constant EVID = keccak256("evidence");

    event InspectionOpened(bytes32 indexed inspectionId, bytes32 indexed lotId, address indexed inspector, bytes32 standard);
    event InspectionRecorded(bytes32 indexed inspectionId, IQualityInspection.Outcome outcome, uint16 defectPpm, bytes32 evidenceHash);
    event InspectionRevoked(bytes32 indexed inspectionId, bytes32 reason);

    function setUp() public {
        book = new AddressBook(admin);
        qi = new QualityInspection(address(book), admin);
        vm.startPrank(admin);
        qi.grantRole(Roles.INSPECTOR_ROLE, inspector);
        qi.grantRole(Roles.INSPECTOR_ROLE, inspector2);
        vm.stopPrank();
    }

    function _open(bytes32 id, address who) internal {
        vm.prank(who);
        qi.openInspection(id, LOT, STD);
    }

    function test_Open_HappyPath() public {
        vm.expectEmit(true, true, true, true, address(qi));
        emit InspectionOpened(I1, LOT, inspector, STD);
        _open(I1, inspector);

        IQualityInspection.Inspection memory insp = qi.inspectionOf(I1);
        assertEq(insp.lotId, LOT);
        assertEq(insp.inspector, inspector);
        assertEq(uint8(insp.outcome), uint8(IQualityInspection.Outcome.Pending));
        assertEq(qi.latestInspectionOf(LOT), I1);
        assertFalse(qi.isPassing(LOT));
    }

    function test_RevertWhen_NonInspectorOpens() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.INSPECTOR_ROLE)
        );
        qi.openInspection(I1, LOT, STD);
    }

    function test_RevertWhen_ZeroLot() public {
        vm.prank(inspector);
        vm.expectRevert(IQualityInspection.ZeroLot.selector);
        qi.openInspection(I1, bytes32(0), STD);
    }

    function test_RevertWhen_DuplicateInspection() public {
        _open(I1, inspector);
        vm.prank(inspector);
        vm.expectRevert(abi.encodeWithSelector(IQualityInspection.InspectionExists.selector, I1));
        qi.openInspection(I1, LOT, STD);
    }

    function test_RecordOutcome_Passed_IsPassing() public {
        _open(I1, inspector);
        vm.expectEmit(true, false, false, true, address(qi));
        emit InspectionRecorded(I1, IQualityInspection.Outcome.Passed, 120, EVID);
        vm.prank(inspector);
        qi.recordOutcome(I1, IQualityInspection.Outcome.Passed, 120, EVID);

        assertTrue(qi.isPassing(LOT));
        IQualityInspection.Inspection memory insp = qi.inspectionOf(I1);
        assertEq(insp.defectPpm, 120);
        assertEq(insp.evidenceHash, EVID);
    }

    function test_RecordOutcome_Conditional_IsPassing() public {
        _open(I1, inspector);
        vm.prank(inspector);
        qi.recordOutcome(I1, IQualityInspection.Outcome.Conditional, 900, EVID);
        assertTrue(qi.isPassing(LOT));
    }

    function test_RecordOutcome_Failed_NotPassing() public {
        _open(I1, inspector);
        vm.prank(inspector);
        qi.recordOutcome(I1, IQualityInspection.Outcome.Failed, 5000, EVID);
        assertFalse(qi.isPassing(LOT));
    }

    function test_RevertWhen_RecordByOtherInspector() public {
        _open(I1, inspector);
        vm.prank(inspector2);
        vm.expectRevert(abi.encodeWithSelector(IQualityInspection.NotInspector.selector, I1));
        qi.recordOutcome(I1, IQualityInspection.Outcome.Passed, 0, EVID);
    }

    function test_RevertWhen_RecordTwice() public {
        _open(I1, inspector);
        vm.startPrank(inspector);
        qi.recordOutcome(I1, IQualityInspection.Outcome.Passed, 0, EVID);
        vm.expectRevert(abi.encodeWithSelector(IQualityInspection.AlreadyRecorded.selector, I1));
        qi.recordOutcome(I1, IQualityInspection.Outcome.Failed, 0, EVID);
        vm.stopPrank();
    }

    function test_RevertWhen_RecordUnknown() public {
        vm.prank(inspector);
        vm.expectRevert(abi.encodeWithSelector(IQualityInspection.UnknownInspection.selector, I1));
        qi.recordOutcome(I1, IQualityInspection.Outcome.Passed, 0, EVID);
    }

    function test_Revoke_FallsBackToPrevious() public {
        _open(I1, inspector);
        vm.prank(inspector);
        qi.recordOutcome(I1, IQualityInspection.Outcome.Passed, 0, EVID);

        _open(I2, inspector2);
        vm.prank(inspector2);
        qi.recordOutcome(I2, IQualityInspection.Outcome.Failed, 9000, EVID);
        assertEq(qi.latestInspectionOf(LOT), I2);
        assertFalse(qi.isPassing(LOT));

        vm.expectEmit(true, false, false, true, address(qi));
        emit InspectionRevoked(I2, keccak256("mistake"));
        vm.prank(inspector2);
        qi.revoke(I2, keccak256("mistake"));

        // Latest falls back to the earlier passing inspection.
        assertEq(qi.latestInspectionOf(LOT), I1);
        assertTrue(qi.isPassing(LOT));
    }

    function test_Revoke_ByAdmin() public {
        _open(I1, inspector);
        vm.prank(admin);
        qi.revoke(I1, keccak256("fraud"));
        assertTrue(qi.inspectionOf(I1).revoked);
        assertEq(qi.latestInspectionOf(LOT), bytes32(0));
    }

    function test_RevertWhen_RevokeByStranger() public {
        _open(I1, inspector);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IQualityInspection.NotInspector.selector, I1));
        qi.revoke(I1, keccak256("x"));
    }

    function test_RevertWhen_RevokeTwice() public {
        _open(I1, inspector);
        vm.startPrank(inspector);
        qi.revoke(I1, keccak256("x"));
        vm.expectRevert(abi.encodeWithSelector(IQualityInspection.AlreadyRevoked.selector, I1));
        qi.revoke(I1, keccak256("y"));
        vm.stopPrank();
    }

    function test_RevertWhen_RecordAfterRevoke() public {
        _open(I1, inspector);
        vm.startPrank(inspector);
        qi.revoke(I1, keccak256("x"));
        vm.expectRevert(abi.encodeWithSelector(IQualityInspection.AlreadyRevoked.selector, I1));
        qi.recordOutcome(I1, IQualityInspection.Outcome.Passed, 0, EVID);
        vm.stopPrank();
    }

    function test_InspectionCount() public {
        _open(I1, inspector);
        _open(I2, inspector);
        assertEq(qi.inspectionCountOf(LOT), 2);
    }
}
