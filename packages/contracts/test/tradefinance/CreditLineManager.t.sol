// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { CreditLineManager } from "../../src/tradefinance/CreditLineManager.sol";
import { ICreditLineManager } from "../../src/interfaces/ICreditLineManager.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockKYCRegistry } from "./mocks/MockKYCRegistry.sol";

contract CreditLineManagerTest is Test {
    AddressBook internal book;
    CreditLineManager internal clm;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE); // underwriter
    address internal borrower = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant LINE = keccak256("line-1");
    uint256 internal constant LIMIT = 1_000e6;
    uint16 internal constant APR = 1_200; // 12% APR

    function setUp() public {
        vm.prank(admin);
        book = new AddressBook(admin);
        clm = new CreditLineManager(address(book), admin);
        usdc = new MockUSDC();

        // Seed the manager's lending liquidity.
        usdc.mint(address(clm), LIMIT * 10);
        // Fund borrower for repayments.
        usdc.mint(borrower, LIMIT * 10);
        vm.prank(borrower);
        usdc.approve(address(clm), type(uint256).max);
    }

    function _open() internal {
        vm.prank(admin);
        clm.openLine(LINE, borrower, address(usdc), LIMIT, APR);
    }

    function test_OpenLine_Happy() public {
        _open();
        ICreditLineManager.CreditLine memory l = clm.lineOf(LINE);
        assertEq(l.borrower, borrower);
        assertEq(l.limit, LIMIT);
        assertEq(l.aprBps, APR);
        assertEq(uint8(l.state), uint8(ICreditLineManager.LineState.Active));
    }

    function test_Revert_OpenLine_NotUnderwriter() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.UNDERWRITER_ROLE)
        );
        clm.openLine(LINE, borrower, address(usdc), LIMIT, APR);
    }

    function test_Draw_TransfersToBorrower() public {
        _open();
        uint256 before = usdc.balanceOf(borrower);
        vm.prank(borrower);
        clm.draw(LINE, 400e6);
        assertEq(usdc.balanceOf(borrower), before + 400e6);
        assertEq(clm.lineOf(LINE).drawn, 400e6);
    }

    function test_Revert_Draw_NotBorrower() public {
        _open();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ICreditLineManager.NotBorrower.selector, LINE));
        clm.draw(LINE, 100e6);
    }

    function test_Revert_Draw_LimitExceeded() public {
        _open();
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(ICreditLineManager.LimitExceeded.selector, LIMIT + 1, LIMIT));
        clm.draw(LINE, LIMIT + 1);
    }

    function test_InterestAccrues_OverTime() public {
        _open();
        vm.prank(borrower);
        clm.draw(LINE, LIMIT); // draw full

        vm.warp(block.timestamp + 365 days);
        // 12% APR on 1000e6 for a full year = 120e6 interest.
        uint256 outstanding = clm.outstandingOf(LINE);
        assertEq(outstanding, LIMIT + 120e6);
    }

    function test_Repay_InterestFirstThenPrincipal() public {
        _open();
        vm.prank(borrower);
        clm.draw(LINE, LIMIT);
        vm.warp(block.timestamp + 365 days); // 120e6 interest accrued

        // Repay 200e6: 120e6 interest, 80e6 principal.
        vm.prank(borrower);
        clm.repay(LINE, 200e6);

        ICreditLineManager.CreditLine memory l = clm.lineOf(LINE);
        assertEq(l.accruedInterest, 0);
        assertEq(l.drawn, LIMIT - 80e6);
    }

    function test_Repay_FullThenClose() public {
        _open();
        vm.prank(borrower);
        clm.draw(LINE, 500e6);
        // No time passes -> no interest. Repay full principal.
        vm.prank(borrower);
        clm.repay(LINE, 500e6);
        assertEq(clm.outstandingOf(LINE), 0);

        vm.prank(admin);
        clm.close(LINE);
        assertEq(uint8(clm.lineOf(LINE).state), uint8(ICreditLineManager.LineState.Closed));
    }

    function test_Revert_Close_OutstandingBalance() public {
        _open();
        vm.prank(borrower);
        clm.draw(LINE, 500e6);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ICreditLineManager.OutstandingBalance.selector, LINE, 500e6));
        clm.close(LINE);
    }

    function test_Freeze_BlocksDraw() public {
        _open();
        vm.prank(admin);
        clm.freeze(LINE);
        assertEq(uint8(clm.lineOf(LINE).state), uint8(ICreditLineManager.LineState.Frozen));
        vm.prank(borrower);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditLineManager.InvalidState.selector,
                LINE,
                ICreditLineManager.LineState.Active,
                ICreditLineManager.LineState.Frozen
            )
        );
        clm.draw(LINE, 100e6);
    }

    function test_KycGate_BlocksUnverified() public {
        MockKYCRegistry kyc = new MockKYCRegistry();
        vm.prank(admin);
        book.setAddress(Keys.KYC_REGISTRY, address(kyc));
        // borrower not verified
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(CreditLineManager.BorrowerNotVerified.selector, borrower));
        clm.openLine(LINE, borrower, address(usdc), LIMIT, APR);

        // Verify and succeed.
        kyc.setVerified(borrower, true);
        vm.prank(admin);
        clm.openLine(LINE, borrower, address(usdc), LIMIT, APR);
        assertEq(uint8(clm.lineOf(LINE).state), uint8(ICreditLineManager.LineState.Active));
    }
}
