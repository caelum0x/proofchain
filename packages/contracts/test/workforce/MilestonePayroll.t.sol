// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { MilestonePayroll } from "../../src/workforce/MilestonePayroll.sol";
import { IMilestonePayroll } from "../../src/interfaces/IMilestonePayroll.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockAttestation } from "./mocks/MockAttestation.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract MilestonePayrollTest is Test {
    AddressBook internal book;
    MilestonePayroll internal pay;
    MockUSDC internal usdc;
    MockAttestation internal att;

    address internal admin = address(0xA11CE);
    address internal agent = address(0xA6E17);
    address internal employer = address(0xE199);
    address internal worker = address(0x0BADBEEF);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant AG = keccak256("payroll-1");
    bytes32 internal constant DELIVERY = keccak256("delivery-att-1");
    uint256 internal constant TOTAL = 1_000e6;

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        pay = new MilestonePayroll(address(book), admin);
        pay.grantRole(Roles.AGENT_ROLE, agent);
        att = new MockAttestation();
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        vm.stopPrank();

        usdc = new MockUSDC();
        usdc.mint(employer, TOTAL * 10);
        vm.prank(employer);
        usdc.approve(address(pay), type(uint256).max);
    }

    function _amounts() internal pure returns (uint256[] memory a) {
        a = new uint256[](2);
        a[0] = 600e6;
        a[1] = 400e6;
    }

    function _hashes() internal pure returns (bytes32[] memory h) {
        h = new bytes32[](2);
        h[0] = keccak256("m0");
        h[1] = keccak256("m1");
    }

    function _create() internal {
        vm.prank(employer);
        pay.createAgreement(AG, worker, address(usdc), TOTAL, _amounts(), _hashes());
    }

    function test_Create_EscrowsAndDefinesMilestones() public {
        _create();
        assertEq(usdc.balanceOf(address(pay)), TOTAL);
        assertEq(usdc.balanceOf(employer), TOTAL * 10 - TOTAL);

        IMilestonePayroll.Agreement memory a = pay.agreementOf(AG);
        assertEq(a.employer, employer);
        assertEq(a.worker, worker);
        assertEq(a.totalAmount, TOTAL);
        assertEq(a.milestoneCount, 2);
        assertEq(uint8(a.state), uint8(IMilestonePayroll.AgreementState.Active));
        assertEq(pay.unreleasedBalance(AG), TOTAL);

        IMilestonePayroll.Milestone memory m0 = pay.milestoneAt(AG, 0);
        assertEq(m0.amount, 600e6);
        assertEq(uint8(m0.state), uint8(IMilestonePayroll.MilestoneState.Pending));
    }

    function test_Revert_Create_Exists() public {
        _create();
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(IMilestonePayroll.AgreementExists.selector, AG));
        pay.createAgreement(AG, worker, address(usdc), TOTAL, _amounts(), _hashes());
    }

    function test_Revert_Create_ZeroWorker() public {
        vm.prank(employer);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        pay.createAgreement(AG, address(0), address(usdc), TOTAL, _amounts(), _hashes());
    }

    function test_Revert_Create_ZeroTotal() public {
        uint256[] memory a = new uint256[](1);
        a[0] = 1;
        bytes32[] memory h = new bytes32[](1);
        h[0] = keccak256("m");
        vm.prank(employer);
        vm.expectRevert(IMilestonePayroll.ZeroAmount.selector);
        pay.createAgreement(AG, worker, address(usdc), 0, a, h);
    }

    function test_Revert_Create_LengthMismatch() public {
        uint256[] memory a = _amounts();
        bytes32[] memory h = new bytes32[](1);
        h[0] = keccak256("m");
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(MilestonePayroll.LengthMismatch.selector, uint256(2), uint256(1)));
        pay.createAgreement(AG, worker, address(usdc), TOTAL, a, h);
    }

    function test_Revert_Create_ZeroMilestoneAmount() public {
        uint256[] memory a = new uint256[](2);
        a[0] = TOTAL;
        a[1] = 0;
        vm.prank(employer);
        vm.expectRevert(IMilestonePayroll.ZeroAmount.selector);
        pay.createAgreement(AG, worker, address(usdc), TOTAL, a, _hashes());
    }

    function test_Revert_Create_SumMismatch() public {
        uint256[] memory a = new uint256[](2);
        a[0] = 500e6;
        a[1] = 400e6; // sums to 900, not 1000
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(IMilestonePayroll.MilestoneSumMismatch.selector, TOTAL, uint256(900e6)));
        pay.createAgreement(AG, worker, address(usdc), TOTAL, a, _hashes());
    }

    function test_ApproveAndRelease_PaysWorker() public {
        _create();
        vm.prank(employer);
        pay.approveMilestone(AG, 0, bytes32(0));
        assertEq(uint8(pay.milestoneAt(AG, 0).state), uint8(IMilestonePayroll.MilestoneState.Approved));

        vm.prank(worker);
        pay.releaseMilestone(AG, 0);
        assertEq(usdc.balanceOf(worker), 600e6);
        assertEq(pay.unreleasedBalance(AG), 400e6);
        assertEq(pay.agreementOf(AG).releasedCount, 1);
    }

    function test_Release_CompletesAgreement() public {
        _create();
        vm.startPrank(agent);
        pay.approveMilestone(AG, 0, bytes32(0));
        pay.approveMilestone(AG, 1, bytes32(0));
        pay.releaseMilestone(AG, 0);
        pay.releaseMilestone(AG, 1);
        vm.stopPrank();

        assertEq(usdc.balanceOf(worker), TOTAL);
        assertEq(usdc.balanceOf(address(pay)), 0);
        assertEq(uint8(pay.agreementOf(AG).state), uint8(IMilestonePayroll.AgreementState.Completed));
        assertEq(pay.unreleasedBalance(AG), 0);
    }

    function test_Approve_WithDeliveryAttestation() public {
        _create();
        att.setAttested(DELIVERY, true);
        vm.prank(employer);
        pay.approveMilestone(AG, 0, DELIVERY);
        assertEq(pay.milestoneAt(AG, 0).attestationId, DELIVERY);
    }

    function test_Revert_Approve_DeliveryNotAttested() public {
        _create();
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(MilestonePayroll.DeliveryNotAttested.selector, DELIVERY));
        pay.approveMilestone(AG, 0, DELIVERY);
    }

    function test_Revert_Approve_NotEmployer() public {
        _create();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IMilestonePayroll.NotEmployer.selector, AG));
        pay.approveMilestone(AG, 0, bytes32(0));
    }

    function test_Revert_Approve_IndexOutOfRange() public {
        _create();
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(IMilestonePayroll.IndexOutOfRange.selector, AG, uint16(5)));
        pay.approveMilestone(AG, 5, bytes32(0));
    }

    function test_Revert_Release_NotApproved() public {
        _create();
        vm.prank(worker);
        vm.expectRevert(
            abi.encodeWithSelector(
                IMilestonePayroll.InvalidMilestoneState.selector,
                AG,
                uint16(0),
                IMilestonePayroll.MilestoneState.Approved,
                IMilestonePayroll.MilestoneState.Pending
            )
        );
        pay.releaseMilestone(AG, 0);
    }

    function test_Revert_Release_NotAuthorized() public {
        _create();
        vm.prank(employer);
        pay.approveMilestone(AG, 0, bytes32(0));
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(MilestonePayroll.NotAuthorized.selector, AG));
        pay.releaseMilestone(AG, 0);
    }

    function test_Cancel_RefundsUnreleased() public {
        _create();
        vm.prank(employer);
        pay.approveMilestone(AG, 0, bytes32(0));
        vm.prank(employer);
        pay.releaseMilestone(AG, 0); // worker gets 600, 400 remains escrowed

        uint256 employerBefore = usdc.balanceOf(employer);
        vm.prank(employer);
        pay.cancel(AG);

        assertEq(usdc.balanceOf(employer), employerBefore + 400e6);
        assertEq(usdc.balanceOf(address(pay)), 0);
        assertEq(uint8(pay.agreementOf(AG).state), uint8(IMilestonePayroll.AgreementState.Cancelled));
        assertEq(uint8(pay.milestoneAt(AG, 1).state), uint8(IMilestonePayroll.MilestoneState.Cancelled));
        assertEq(pay.unreleasedBalance(AG), 0);
    }

    function test_Revert_Cancel_NotEmployer() public {
        _create();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IMilestonePayroll.NotEmployer.selector, AG));
        pay.cancel(AG);
    }

    function test_Revert_Approve_UnknownAgreement() public {
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(IMilestonePayroll.UnknownAgreement.selector, AG));
        pay.approveMilestone(AG, 0, bytes32(0));
    }

    function test_Revert_Release_AfterCancel_InvalidState() public {
        _create();
        vm.prank(employer);
        pay.cancel(AG);
        vm.prank(employer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IMilestonePayroll.InvalidState.selector,
                AG,
                IMilestonePayroll.AgreementState.Active,
                IMilestonePayroll.AgreementState.Cancelled
            )
        );
        pay.approveMilestone(AG, 0, bytes32(0));
    }
}
