// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { DutyAndTariffCalculator } from "../../src/compliance/DutyAndTariffCalculator.sol";
import { IDutyAndTariffCalculator } from "../../src/interfaces/IDutyAndTariffCalculator.sol";

contract DutyAndTariffCalculatorTest is Test {
    AddressBook internal book;
    DutyAndTariffCalculator internal calc;

    address internal admin = address(0xA11CE);
    address internal governor = address(0x60);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant HS = bytes32("8703");
    bytes32 internal constant ORIGIN = bytes32("JP");
    bytes32 internal constant DEST = bytes32("DE");

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        calc = new DutyAndTariffCalculator(address(book), admin);
        calc.grantRole(Roles.GOVERNOR_ROLE, governor);
        vm.stopPrank();
    }

    function test_SetRate_AndAssess() public {
        vm.prank(governor);
        calc.setRate(HS, ORIGIN, DEST, 1000, 1900, 500, false); // 10% duty, 19% VAT, 5% excise

        IDutyAndTariffCalculator.Assessment memory a = calc.assess(HS, ORIGIN, DEST, 100_000);
        assertEq(a.dutyAmount, 10_000); // 10% of 100k
        assertEq(a.exciseAmount, 5_000); // 5% of 100k
        // VAT = 19% of (100k + 10k + 5k) = 21,850
        assertEq(a.vatAmount, 21_850);
        assertEq(a.totalPayable, 10_000 + 5_000 + 21_850);
    }

    function test_Assess_Preferential_ZeroDuty() public {
        vm.prank(governor);
        calc.setRate(HS, ORIGIN, DEST, 1000, 1900, 0, true);

        IDutyAndTariffCalculator.Assessment memory a = calc.assess(HS, ORIGIN, DEST, 100_000);
        assertEq(a.dutyAmount, 0);
        assertEq(a.vatAmount, 19_000); // 19% of 100k (no duty/excise)
        assertEq(a.totalPayable, 19_000);
    }

    function test_ClearRate() public {
        vm.startPrank(governor);
        calc.setRate(HS, ORIGIN, DEST, 1000, 0, 0, false);
        calc.clearRate(HS, ORIGIN, DEST);
        vm.stopPrank();
        assertFalse(calc.rateOf(HS, ORIGIN, DEST).set);
    }

    function test_Revert_SetRate_InvalidBps() public {
        vm.prank(governor);
        vm.expectRevert(abi.encodeWithSelector(IDutyAndTariffCalculator.InvalidBps.selector, uint16(10_001)));
        calc.setRate(HS, ORIGIN, DEST, 10_001, 0, 0, false);
    }

    function test_Revert_Assess_RateNotSet() public {
        vm.expectRevert(abi.encodeWithSelector(IDutyAndTariffCalculator.RateNotSet.selector, HS, ORIGIN, DEST));
        calc.assess(HS, ORIGIN, DEST, 100_000);
    }

    function test_Revert_Assess_ZeroValue() public {
        vm.prank(governor);
        calc.setRate(HS, ORIGIN, DEST, 1000, 0, 0, false);
        vm.expectRevert(IDutyAndTariffCalculator.ZeroValue.selector);
        calc.assess(HS, ORIGIN, DEST, 0);
    }

    function test_Revert_ClearRate_NotSet() public {
        vm.prank(governor);
        vm.expectRevert(abi.encodeWithSelector(IDutyAndTariffCalculator.RateNotSet.selector, HS, ORIGIN, DEST));
        calc.clearRate(HS, ORIGIN, DEST);
    }

    function test_Revert_SetRate_AccessControl() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.GOVERNOR_ROLE
            )
        );
        calc.setRate(HS, ORIGIN, DEST, 1000, 0, 0, false);
    }
}
