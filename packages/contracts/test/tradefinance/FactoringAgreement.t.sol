// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { FactoringAgreement } from "../../src/tradefinance/FactoringAgreement.sol";
import { IFactoringAgreement } from "../../src/interfaces/IFactoringAgreement.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockAttestation } from "./mocks/MockAttestation.sol";

contract FactoringAgreementTest is Test {
    AddressBook internal book;
    FactoringAgreement internal fa;
    MockAttestation internal att;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal seller = address(0x5E11);
    address internal factor = address(0xFAC2);
    address internal debtor = address(0xDEB7);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant AG = keccak256("ag-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    uint256 internal constant FACE = 1_000e6;
    uint16 internal constant ADV_BPS = 8_000; // 80%
    uint16 internal constant FEE_BPS = 200; // 2%
    uint64 internal maturity;

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        fa = new FactoringAgreement(address(book), admin);
        att = new MockAttestation();
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        vm.stopPrank();

        usdc = new MockUSDC();
        att.setAttested(BATCH, true, 9600);
        maturity = uint64(block.timestamp + 30 days);

        usdc.mint(factor, FACE * 10);
        usdc.mint(debtor, FACE * 10);
        usdc.mint(seller, FACE * 10);
        vm.prank(factor);
        usdc.approve(address(fa), type(uint256).max);
        vm.prank(debtor);
        usdc.approve(address(fa), type(uint256).max);
        vm.prank(seller);
        usdc.approve(address(fa), type(uint256).max);
    }

    function _offer(bool recourse) internal {
        vm.prank(seller);
        fa.offer(AG, BATCH, debtor, address(usdc), FACE, ADV_BPS, FEE_BPS, maturity, recourse);
    }

    function _fund() internal {
        vm.prank(factor);
        fa.fund(AG);
    }

    function test_Offer_ComputesAdvance() public {
        _offer(false);
        IFactoringAgreement.Agreement memory a = fa.agreementOf(AG);
        assertEq(a.advanceAmount, (FACE * ADV_BPS) / 10_000); // 800e6
        assertEq(uint8(a.state), uint8(IFactoringAgreement.AgreementState.Offered));
    }

    function test_Revert_Offer_NotAttested() public {
        att.setAttested(BATCH, false, 0);
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(IFactoringAgreement.NotAttested.selector, BATCH));
        fa.offer(AG, BATCH, debtor, address(usdc), FACE, ADV_BPS, FEE_BPS, maturity, false);
    }

    function test_Revert_Offer_InvalidRate() public {
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(IFactoringAgreement.InvalidRate.selector, uint16(0)));
        fa.offer(AG, BATCH, debtor, address(usdc), FACE, 0, FEE_BPS, maturity, false);
    }

    function test_Fund_AdvancesToSeller() public {
        _offer(false);
        uint256 before = usdc.balanceOf(seller);
        _fund();
        uint256 advance = (FACE * ADV_BPS) / 10_000;
        assertEq(usdc.balanceOf(seller), before + advance);
        assertEq(fa.agreementOf(AG).factor, factor);
    }

    function test_Collect_NetsFeeAndRebates() public {
        _offer(false);
        _fund();

        uint256 advance = (FACE * ADV_BPS) / 10_000; // 800e6
        uint256 fee = (FACE * FEE_BPS) / 10_000; // 20e6
        uint256 factorTake = advance + fee; // 820e6
        uint256 rebate = FACE - factorTake; // 180e6

        uint256 factorBefore = usdc.balanceOf(factor);
        uint256 sellerBefore = usdc.balanceOf(seller);

        vm.prank(factor);
        fa.collect(AG);

        assertEq(uint8(fa.agreementOf(AG).state), uint8(IFactoringAgreement.AgreementState.Collected));
        assertEq(usdc.balanceOf(factor), factorBefore + factorTake);
        assertEq(usdc.balanceOf(seller), sellerBefore + rebate);
        assertEq(usdc.balanceOf(address(fa)), 0);
    }

    function test_Revert_Collect_NotFactor() public {
        _offer(false);
        _fund();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IFactoringAgreement.NotFactor.selector, AG));
        fa.collect(AG);
    }

    function test_MarkDefault_Recourse_ChargesSeller() public {
        _offer(true);
        _fund();
        vm.warp(block.timestamp + 31 days);

        uint256 advance = (FACE * ADV_BPS) / 10_000;
        uint256 factorBefore = usdc.balanceOf(factor);
        uint256 sellerBefore = usdc.balanceOf(seller);

        vm.prank(factor);
        fa.markDefault(AG);

        assertEq(uint8(fa.agreementOf(AG).state), uint8(IFactoringAgreement.AgreementState.Defaulted));
        assertEq(usdc.balanceOf(factor), factorBefore + advance); // seller reimbursed the advance
        assertEq(usdc.balanceOf(seller), sellerBefore - advance);
    }

    function test_MarkDefault_NonRecourse_NoCharge() public {
        _offer(false);
        _fund();
        vm.warp(block.timestamp + 31 days);
        uint256 sellerBefore = usdc.balanceOf(seller);
        vm.prank(factor);
        fa.markDefault(AG);
        assertEq(usdc.balanceOf(seller), sellerBefore); // non-recourse: seller not charged
    }

    function test_Revert_MarkDefault_NotYetDue() public {
        _offer(true);
        _fund();
        vm.prank(factor);
        vm.expectRevert(abi.encodeWithSelector(FactoringAgreement.NotYetDue.selector, AG, maturity));
        fa.markDefault(AG);
    }

    function test_Cancel_UnfundedOffer() public {
        _offer(false);
        vm.prank(seller);
        fa.cancel(AG);
        assertEq(uint8(fa.agreementOf(AG).state), uint8(IFactoringAgreement.AgreementState.Cancelled));
    }

    function test_Revert_Cancel_NotSeller() public {
        _offer(false);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IFactoringAgreement.NotSeller.selector, AG));
        fa.cancel(AG);
    }
}
