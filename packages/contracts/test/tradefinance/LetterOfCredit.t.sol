// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { LetterOfCredit } from "../../src/tradefinance/LetterOfCredit.sol";
import { ILetterOfCredit } from "../../src/interfaces/ILetterOfCredit.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockAttestation } from "./mocks/MockAttestation.sol";

contract LetterOfCreditTest is Test {
    AddressBook internal book;
    LetterOfCredit internal lc;
    MockAttestation internal att;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE); // issuing bank (UNDERWRITER_ROLE)
    address internal applicant = address(0xAAAA); // importer
    address internal beneficiary = address(0xB0B); // exporter
    address internal stranger = address(0xDEAD);

    bytes32 internal constant LC = keccak256("lc-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    uint256 internal constant AMOUNT = 1_000e6;
    uint64 internal expiry;

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        lc = new LetterOfCredit(address(book), admin);
        att = new MockAttestation();
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        vm.stopPrank();

        usdc = new MockUSDC();
        usdc.mint(admin, AMOUNT * 10);
        vm.prank(admin);
        usdc.approve(address(lc), type(uint256).max);

        att.setAttested(BATCH, true, 9600);
        expiry = uint64(block.timestamp + 30 days);
    }

    function _issue() internal {
        vm.prank(admin);
        lc.issue(LC, BATCH, applicant, beneficiary, address(usdc), AMOUNT, expiry, keccak256("terms"));
    }

    function test_Issue_Happy() public {
        _issue();
        ILetterOfCredit.Credit memory c = lc.creditOf(LC);
        assertEq(uint8(c.state), uint8(ILetterOfCredit.LCState.Issued));
        assertEq(c.issuer, admin);
        assertEq(c.beneficiary, beneficiary);
        assertEq(c.amount, AMOUNT);
        assertEq(usdc.balanceOf(address(lc)), AMOUNT); // collateral escrowed
    }

    function test_Revert_Issue_NotUnderwriter() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.UNDERWRITER_ROLE)
        );
        lc.issue(LC, BATCH, applicant, beneficiary, address(usdc), AMOUNT, expiry, bytes32(0));
    }

    function test_Revert_Issue_ZeroAmount() public {
        vm.prank(admin);
        vm.expectRevert(ILetterOfCredit.ZeroAmount.selector);
        lc.issue(LC, BATCH, applicant, beneficiary, address(usdc), 0, expiry, bytes32(0));
    }

    function test_Revert_Issue_PastExpiry() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ILetterOfCredit.PastExpiry.selector, uint64(block.timestamp)));
        lc.issue(LC, BATCH, applicant, beneficiary, address(usdc), AMOUNT, uint64(block.timestamp), bytes32(0));
    }

    function test_Revert_Issue_CreditExists() public {
        _issue();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ILetterOfCredit.CreditExists.selector, LC));
        lc.issue(LC, BATCH, applicant, beneficiary, address(usdc), AMOUNT, expiry, bytes32(0));
    }

    function test_PresentAndAccept_PaysBeneficiary() public {
        _issue();
        vm.prank(beneficiary);
        lc.presentDocuments(LC, keccak256("docs"));
        assertEq(uint8(lc.stateOf(LC)), uint8(ILetterOfCredit.LCState.DocumentsPresented));

        vm.prank(admin);
        lc.accept(LC);

        assertEq(uint8(lc.stateOf(LC)), uint8(ILetterOfCredit.LCState.Paid));
        assertEq(usdc.balanceOf(beneficiary), AMOUNT);
        assertEq(usdc.balanceOf(address(lc)), 0);
    }

    function test_Revert_Present_NotBeneficiary() public {
        _issue();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ILetterOfCredit.NotBeneficiary.selector, LC));
        lc.presentDocuments(LC, keccak256("docs"));
    }

    function test_Revert_Accept_NotIssuer() public {
        _issue();
        vm.prank(beneficiary);
        lc.presentDocuments(LC, keccak256("docs"));
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ILetterOfCredit.NotIssuer.selector, LC));
        lc.accept(LC);
    }

    function test_Revert_Accept_DocumentsNotAttested() public {
        att.setAttested(BATCH, false, 0);
        _issue();
        vm.prank(beneficiary);
        lc.presentDocuments(LC, keccak256("docs"));
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ILetterOfCredit.DocumentsNotAttested.selector, LC));
        lc.accept(LC);
    }

    function test_Reject_ReturnsToApplicant() public {
        _issue();
        vm.prank(beneficiary);
        lc.presentDocuments(LC, keccak256("docs"));
        vm.prank(admin);
        lc.reject(LC, "discrepant B/L");

        assertEq(uint8(lc.stateOf(LC)), uint8(ILetterOfCredit.LCState.Rejected));
        assertEq(usdc.balanceOf(applicant), AMOUNT);
        assertEq(usdc.balanceOf(beneficiary), 0);
    }

    function test_Expire_ReturnsToApplicant() public {
        _issue();
        vm.warp(block.timestamp + 31 days);
        lc.expire(LC);
        assertEq(uint8(lc.stateOf(LC)), uint8(ILetterOfCredit.LCState.Expired));
        assertEq(usdc.balanceOf(applicant), AMOUNT);
    }

    function test_Revert_Expire_BeforeExpiry() public {
        _issue();
        vm.expectRevert(abi.encodeWithSelector(ILetterOfCredit.PastExpiry.selector, expiry));
        lc.expire(LC);
    }

    function test_Cancel_ReturnsToApplicant() public {
        _issue();
        vm.prank(applicant);
        lc.cancel(LC);
        assertEq(uint8(lc.stateOf(LC)), uint8(ILetterOfCredit.LCState.Cancelled));
        assertEq(usdc.balanceOf(applicant), AMOUNT);
    }

    function test_Revert_Cancel_NotApplicant() public {
        _issue();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ILetterOfCredit.NotApplicant.selector, LC));
        lc.cancel(LC);
    }

    function test_Revert_UnknownCredit() public {
        vm.expectRevert(abi.encodeWithSelector(ILetterOfCredit.UnknownCredit.selector, keccak256("nope")));
        lc.accept(keccak256("nope"));
    }
}
