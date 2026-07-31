// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { DiscountCalculator } from "../../src/finance/DiscountCalculator.sol";
import { IDiscountCalculator } from "../../src/interfaces/IDiscountCalculator.sol";

contract DiscountCalculatorTest is Test {
    AddressBook internal book;
    DiscountCalculator internal calc;

    address internal admin = address(0xA11CE);
    address internal stranger = address(0xDEAD);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        calc = new DiscountCalculator(address(book), admin);
        vm.stopPrank();
    }

    function test_Defaults() public view {
        assertEq(calc.gradeStepBps(), 50);
        assertEq(calc.dailyBps(), 2);
        assertEq(calc.maxDiscountBps(), 3000);
    }

    function test_DiscountBps_GradeAndTenor() public view {
        // grade 3, 30 days: 3*50 + 30*2 = 210 bps
        assertEq(calc.discountBps(3, 30), 210);
        // grade 1, 0 days: 50 bps
        assertEq(calc.discountBps(1, 0), 50);
    }

    function test_DiscountBps_MonotonicInGrade() public view {
        assertGt(calc.discountBps(5, 10), calc.discountBps(2, 10));
    }

    function test_DiscountBps_CappedAtMax() public view {
        // worst grade + huge tenor saturates at the cap
        assertEq(calc.discountBps(7, 100_000), calc.maxDiscountBps());
    }

    function test_AdvanceFor() public view {
        // face 1_000e6, discount 210 bps -> advance = face * 9790 / 10000
        uint256 adv = calc.advanceFor(1_000e6, 3, 30);
        assertEq(adv, (1_000e6 * 9790) / 10_000);
        assertLt(adv, 1_000e6);
    }

    function test_AdvanceFor_ZeroDiscountEdge() public {
        // With 0 grade-step and 0 daily rate discount is 0 -> advance == face.
        vm.prank(admin);
        calc.setParams(0, 0, 3000);
        assertEq(calc.advanceFor(500e6, 4, 90), 500e6);
    }

    // --- reverts ---

    function test_Revert_InvalidGrade_Zero() public {
        vm.expectRevert(abi.encodeWithSelector(IDiscountCalculator.InvalidGrade.selector, uint8(0)));
        calc.discountBps(0, 10);
    }

    function test_Revert_InvalidGrade_TooHigh() public {
        vm.expectRevert(abi.encodeWithSelector(IDiscountCalculator.InvalidGrade.selector, uint8(8)));
        calc.advanceFor(1e6, 8, 10);
    }

    function test_Revert_ZeroFaceValue() public {
        vm.expectRevert(IDiscountCalculator.ZeroFaceValue.selector);
        calc.advanceFor(0, 3, 10);
    }

    function test_SetParams_Effect() public {
        vm.prank(admin);
        calc.setParams(100, 5, 5000);
        assertEq(calc.discountBps(2, 10), 2 * 100 + 10 * 5);
    }

    function test_Revert_SetParams_InvalidCap() public {
        vm.prank(admin);
        vm.expectRevert(DiscountCalculator.InvalidParams.selector);
        calc.setParams(50, 2, 0);

        vm.prank(admin);
        vm.expectRevert(DiscountCalculator.InvalidParams.selector);
        calc.setParams(50, 2, 10_000);
    }

    function test_Revert_SetParams_NotAdmin() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        calc.setParams(1, 1, 100);
    }
}
