// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { PremiumCalculator } from "../../src/insurance/PremiumCalculator.sol";
import { IPremiumCalculator } from "../../src/interfaces/IPremiumCalculator.sol";

contract PremiumCalculatorTest is Test {
    AddressBook internal book;
    PremiumCalculator internal calc;

    address internal admin = address(0xA11CE);
    address internal stranger = address(0xDEAD);

    event PremiumBpsUpdated(uint8 indexed grade, uint16 oldBps, uint16 newBps);

    function setUp() public {
        book = new AddressBook(admin);
        calc = new PremiumCalculator(address(book), admin);
    }

    function test_DefaultRates_AreRiskMonotonic() public view {
        uint16 last;
        for (uint8 g = 1; g <= 7; g++) {
            uint16 bps = calc.premiumBps(g);
            assertGt(bps, last, "premium must increase with worse grade");
            last = bps;
        }
    }

    function test_PremiumFor_ComputesBps() public view {
        // grade 3 = 250 bps -> 2.5% of 1_000e6 = 25e6
        assertEq(calc.premiumFor(1_000e6, 3), 25e6);
        // grade 1 = 100 bps -> 1% of 1_000e6 = 10e6
        assertEq(calc.premiumFor(1_000e6, 1), 10e6);
        // grade 7 = 1500 bps -> 15% of 1_000e6 = 150e6
        assertEq(calc.premiumFor(1_000e6, 7), 150e6);
    }

    function test_PremiumFor_RevertsZeroCoverage() public {
        vm.expectRevert(IPremiumCalculator.ZeroCoverage.selector);
        calc.premiumFor(0, 3);
    }

    function test_PremiumFor_RevertsInvalidGrade() public {
        vm.expectRevert(abi.encodeWithSelector(IPremiumCalculator.InvalidGrade.selector, uint8(0)));
        calc.premiumFor(1_000e6, 0);
        vm.expectRevert(abi.encodeWithSelector(IPremiumCalculator.InvalidGrade.selector, uint8(8)));
        calc.premiumFor(1_000e6, 8);
    }

    function test_PremiumBps_RevertsInvalidGrade() public {
        vm.expectRevert(abi.encodeWithSelector(IPremiumCalculator.InvalidGrade.selector, uint8(0)));
        calc.premiumBps(0);
    }

    function test_SetPremiumBps_UpdatesRate() public {
        vm.expectEmit(true, false, false, true);
        emit PremiumBpsUpdated(3, 250, 300);
        vm.prank(admin);
        calc.setPremiumBps(3, 300);
        assertEq(calc.premiumBps(3), 300);
        assertEq(calc.premiumFor(1_000e6, 3), 30e6);
    }

    function test_SetPremiumBps_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.POOL_MANAGER_ROLE
            )
        );
        calc.setPremiumBps(3, 300);
    }

    function test_SetPremiumBps_RevertsInvalidGrade() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IPremiumCalculator.InvalidGrade.selector, uint8(8)));
        calc.setPremiumBps(8, 300);
    }

    function test_SetPremiumBps_RevertsRateAboveMax() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IPremiumCalculator.InvalidGrade.selector, uint8(3)));
        calc.setPremiumBps(3, 10_001);
    }

    function testFuzz_PremiumFor_NeverExceedsCoverage(uint256 coverage, uint8 grade) public view {
        coverage = bound(coverage, 1, 1e30);
        grade = uint8(bound(grade, 1, 7));
        assertLe(calc.premiumFor(coverage, grade), coverage);
    }
}
