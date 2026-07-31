// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ProductRecallRegistry } from "../../src/compliance/ProductRecallRegistry.sol";
import { IProductRecallRegistry } from "../../src/interfaces/IProductRecallRegistry.sol";

contract ProductRecallRegistryTest is Test {
    AddressBook internal book;
    ProductRecallRegistry internal recalls;

    address internal admin = address(0xA11CE);
    address internal manufacturer = address(0x9A);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant RECALL = keccak256("recall-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant REASON = keccak256("contamination");

    event RecallOpened(
        bytes32 indexed recallId,
        bytes32 indexed batchId,
        address indexed initiator,
        IProductRecallRegistry.Severity severity,
        uint256 affectedUnits
    );
    event UnitsRemediated(bytes32 indexed recallId, uint256 units, uint256 totalRemediated);
    event RecallResolved(bytes32 indexed recallId);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        recalls = new ProductRecallRegistry(address(book), admin);
        recalls.grantRole(Roles.REGISTRAR_ROLE, manufacturer);
        vm.stopPrank();
    }

    function _open() internal {
        vm.prank(manufacturer);
        recalls.openRecall(RECALL, BATCH, IProductRecallRegistry.Severity.ClassII, REASON, 1000);
    }

    function test_Open_Happy() public {
        vm.expectEmit(true, true, true, true);
        emit RecallOpened(RECALL, BATCH, manufacturer, IProductRecallRegistry.Severity.ClassII, 1000);
        _open();

        assertTrue(recalls.isRecalled(BATCH));
        IProductRecallRegistry.Recall memory r = recalls.recallOf(RECALL);
        assertEq(uint8(r.state), uint8(IProductRecallRegistry.RecallState.Open));
        assertEq(r.affectedUnits, 1000);
        assertEq(r.initiator, manufacturer);
    }

    function test_Escalate() public {
        _open();
        vm.prank(manufacturer);
        recalls.escalate(RECALL, IProductRecallRegistry.Severity.ClassI);
        IProductRecallRegistry.Recall memory r = recalls.recallOf(RECALL);
        assertEq(uint8(r.state), uint8(IProductRecallRegistry.RecallState.Escalated));
        assertEq(uint8(r.severity), uint8(IProductRecallRegistry.Severity.ClassI));
        assertTrue(recalls.isRecalled(BATCH));
    }

    function test_RecordRemediation_AndResolve() public {
        _open();
        vm.startPrank(manufacturer);
        vm.expectEmit(true, false, false, true);
        emit UnitsRemediated(RECALL, 400, 400);
        recalls.recordRemediation(RECALL, 400);
        recalls.recordRemediation(RECALL, 600);
        assertEq(recalls.recallOf(RECALL).remediatedUnits, 1000);

        vm.expectEmit(true, false, false, false);
        emit RecallResolved(RECALL);
        recalls.resolve(RECALL);
        vm.stopPrank();

        assertFalse(recalls.isRecalled(BATCH));
        assertEq(uint8(recalls.recallOf(RECALL).state), uint8(IProductRecallRegistry.RecallState.Resolved));
    }

    function test_Cancel() public {
        _open();
        vm.prank(manufacturer);
        recalls.cancel(RECALL);
        assertFalse(recalls.isRecalled(BATCH));
        assertEq(uint8(recalls.recallOf(RECALL).state), uint8(IProductRecallRegistry.RecallState.Cancelled));
    }

    function test_ComplianceOfficerCanOpen() public {
        // admin holds COMPLIANCE_OFFICER_ROLE by default.
        vm.prank(admin);
        recalls.openRecall(RECALL, BATCH, IProductRecallRegistry.Severity.Advisory, REASON, 5);
        assertTrue(recalls.isRecalled(BATCH));
    }

    function test_Revert_Open_Exists() public {
        _open();
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(IProductRecallRegistry.RecallExists.selector, RECALL));
        recalls.openRecall(RECALL, BATCH, IProductRecallRegistry.Severity.ClassII, REASON, 1000);
    }

    function test_Revert_Open_ZeroUnits() public {
        vm.prank(manufacturer);
        vm.expectRevert(IProductRecallRegistry.ZeroUnits.selector);
        recalls.openRecall(RECALL, BATCH, IProductRecallRegistry.Severity.ClassII, REASON, 0);
    }

    function test_Revert_Open_NotRecaller() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.COMPLIANCE_OFFICER_ROLE
            )
        );
        recalls.openRecall(RECALL, BATCH, IProductRecallRegistry.Severity.ClassII, REASON, 1000);
    }

    function test_Revert_Escalate_NotInitiator() public {
        _open();
        vm.prank(admin); // has role but is not the initiator
        vm.expectRevert(abi.encodeWithSelector(IProductRecallRegistry.NotInitiator.selector, RECALL));
        recalls.escalate(RECALL, IProductRecallRegistry.Severity.ClassI);
    }

    function test_Revert_Remediation_Exceeds() public {
        _open();
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(IProductRecallRegistry.ExceedsAffected.selector, 1001, 1000));
        recalls.recordRemediation(RECALL, 1001);
    }

    function test_Revert_Resolve_Unknown() public {
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(IProductRecallRegistry.UnknownRecall.selector, RECALL));
        recalls.resolve(RECALL);
    }

    function test_Revert_Resolve_WrongState() public {
        _open();
        vm.startPrank(manufacturer);
        recalls.resolve(RECALL);
        vm.expectRevert(
            abi.encodeWithSelector(
                IProductRecallRegistry.InvalidState.selector,
                RECALL,
                IProductRecallRegistry.RecallState.Open,
                IProductRecallRegistry.RecallState.Resolved
            )
        );
        recalls.resolve(RECALL);
        vm.stopPrank();
    }
}
