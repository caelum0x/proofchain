// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { Roles } from "../../src/core/Roles.sol";
import { EmissionsTrading } from "../../src/energy/EmissionsTrading.sol";
import { IEmissionsTrading } from "../../src/interfaces/IEmissionsTrading.sol";

contract EmissionsTradingTest is Test {
    AddressBook internal book;
    EmissionsTrading internal ets;

    address internal admin = address(0xA11CE);
    address internal agent = address(0xA6E7);
    address internal instA = address(0x1157A);
    address internal instB = address(0x1157B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant PERIOD = keccak256("2024-Q1");
    uint256 internal constant CAP = 10_000;

    event PeriodOpened(bytes32 indexed periodId, uint256 cap, uint64 startsAt, uint64 endsAt);
    event Allocated(bytes32 indexed periodId, address indexed installation, uint256 amount);
    event Transferred(bytes32 indexed periodId, address indexed from, address indexed to, uint256 amount);
    event Surrendered(bytes32 indexed periodId, address indexed installation, uint256 amount);

    function setUp() public {
        book = new AddressBook(admin);
        ets = new EmissionsTrading(address(book), admin);
        vm.prank(admin);
        ets.grantRole(Roles.AGENT_ROLE, agent);
    }

    function _open() internal {
        vm.prank(admin);
        ets.openPeriod(PERIOD, CAP, uint64(block.timestamp), uint64(block.timestamp + 90 days));
    }

    // ------------------------------------------------------------- openPeriod

    function test_OpenPeriod_Happy() public {
        vm.expectEmit(true, false, false, true, address(ets));
        emit PeriodOpened(PERIOD, CAP, uint64(block.timestamp), uint64(block.timestamp + 90 days));
        _open();
        IEmissionsTrading.Period memory p = ets.periodOf(PERIOD);
        assertEq(p.cap, CAP);
        assertEq(uint8(p.state), uint8(IEmissionsTrading.PeriodState.Open));
    }

    function test_Revert_OpenPeriod_Exists() public {
        _open();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IEmissionsTrading.PeriodExists.selector, PERIOD));
        ets.openPeriod(PERIOD, CAP, uint64(block.timestamp), uint64(block.timestamp + 1 days));
    }

    function test_Revert_OpenPeriod_ZeroCap() public {
        vm.prank(admin);
        vm.expectRevert(IEmissionsTrading.ZeroAmount.selector);
        ets.openPeriod(PERIOD, 0, uint64(block.timestamp), uint64(block.timestamp + 1 days));
    }

    function test_Revert_OpenPeriod_InvalidWindow() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IEmissionsTrading.InvalidWindow.selector, uint64(100), uint64(100)));
        ets.openPeriod(PERIOD, CAP, 100, 100);
    }

    function test_Revert_OpenPeriod_NotGovernor() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.GOVERNOR_ROLE)
        );
        ets.openPeriod(PERIOD, CAP, uint64(block.timestamp), uint64(block.timestamp + 1 days));
    }

    // ------------------------------------------------------------- allocate

    function test_Allocate_Happy() public {
        _open();
        vm.expectEmit(true, true, false, true, address(ets));
        emit Allocated(PERIOD, instA, 4000);
        vm.prank(admin);
        ets.allocate(PERIOD, instA, 4000);
        assertEq(ets.balanceOf(PERIOD, instA), 4000);
        assertEq(ets.periodOf(PERIOD).allocated, 4000);
    }

    function test_Revert_Allocate_CapExceeded() public {
        _open();
        vm.startPrank(admin);
        ets.allocate(PERIOD, instA, 8000);
        vm.expectRevert(abi.encodeWithSelector(IEmissionsTrading.CapExceeded.selector, PERIOD, 3000, 2000));
        ets.allocate(PERIOD, instA, 3000);
        vm.stopPrank();
    }

    function test_Revert_Allocate_UnknownPeriod() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IEmissionsTrading.UnknownPeriod.selector, PERIOD));
        ets.allocate(PERIOD, instA, 1000);
    }

    function test_Revert_Allocate_NotPoolManager() public {
        _open();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.POOL_MANAGER_ROLE)
        );
        ets.allocate(PERIOD, instA, 1000);
    }

    // ------------------------------------------------------------- transfer

    function test_Transfer_Happy() public {
        _open();
        vm.prank(admin);
        ets.allocate(PERIOD, instA, 4000);

        vm.expectEmit(true, true, true, true, address(ets));
        emit Transferred(PERIOD, instA, instB, 1500);
        vm.prank(instA);
        ets.transfer(PERIOD, instB, 1500);

        assertEq(ets.balanceOf(PERIOD, instA), 2500);
        assertEq(ets.balanceOf(PERIOD, instB), 1500);
    }

    function test_Revert_Transfer_Insufficient() public {
        _open();
        vm.prank(admin);
        ets.allocate(PERIOD, instA, 1000);
        vm.prank(instA);
        vm.expectRevert(abi.encodeWithSelector(IEmissionsTrading.InsufficientAllowances.selector, instA, 2000, 1000));
        ets.transfer(PERIOD, instB, 2000);
    }

    // ------------------------------------------------------------- report + surrender + compliance

    function test_ReportEmissions_OnlyAgent() public {
        _open();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.AGENT_ROLE)
        );
        ets.reportEmissions(PERIOD, instA, 3000);
    }

    function test_Surrender_And_Compliance() public {
        _open();
        vm.prank(admin);
        ets.allocate(PERIOD, instA, 4000);
        vm.prank(agent);
        ets.reportEmissions(PERIOD, instA, 3000);

        // Not yet compliant (0 surrendered < 3000 reported).
        assertFalse(ets.isCompliant(PERIOD, instA));

        vm.expectEmit(true, true, false, true, address(ets));
        emit Surrendered(PERIOD, instA, 3000);
        vm.prank(instA);
        ets.surrender(PERIOD, 3000);

        assertTrue(ets.isCompliant(PERIOD, instA));
        assertEq(ets.balanceOf(PERIOD, instA), 1000);
        IEmissionsTrading.Account memory acct = ets.accountOf(PERIOD, instA);
        assertEq(acct.surrendered, 3000);
        assertEq(acct.reportedEmissions, 3000);
    }

    function test_Revert_Surrender_Insufficient() public {
        _open();
        vm.prank(admin);
        ets.allocate(PERIOD, instA, 1000);
        vm.prank(instA);
        vm.expectRevert(abi.encodeWithSelector(IEmissionsTrading.InsufficientAllowances.selector, instA, 2000, 1000));
        ets.surrender(PERIOD, 2000);
    }

    // ------------------------------------------------------------- lifecycle

    function test_Reconciliation_BlocksAllocation_AllowsSurrender() public {
        _open();
        vm.prank(admin);
        ets.allocate(PERIOD, instA, 4000);
        vm.prank(agent);
        ets.reportEmissions(PERIOD, instA, 2000);

        vm.prank(admin);
        ets.beginReconciliation(PERIOD);
        assertEq(uint8(ets.periodOf(PERIOD).state), uint8(IEmissionsTrading.PeriodState.Reconciling));

        // Allocation now blocked.
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                IEmissionsTrading.InvalidState.selector,
                PERIOD,
                IEmissionsTrading.PeriodState.Open,
                IEmissionsTrading.PeriodState.Reconciling
            )
        );
        ets.allocate(PERIOD, instB, 1000);

        // Surrender still allowed.
        vm.prank(instA);
        ets.surrender(PERIOD, 2000);
        assertTrue(ets.isCompliant(PERIOD, instA));
    }

    function test_ClosePeriod_BlocksEverything() public {
        _open();
        vm.startPrank(admin);
        ets.beginReconciliation(PERIOD);
        ets.closePeriod(PERIOD);
        vm.stopPrank();
        assertEq(uint8(ets.periodOf(PERIOD).state), uint8(IEmissionsTrading.PeriodState.Closed));

        vm.prank(instA);
        vm.expectRevert(
            abi.encodeWithSelector(
                IEmissionsTrading.InvalidState.selector,
                PERIOD,
                IEmissionsTrading.PeriodState.Open,
                IEmissionsTrading.PeriodState.Closed
            )
        );
        ets.transfer(PERIOD, instB, 1);
    }

    function test_Revert_ClosePeriod_Unknown() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IEmissionsTrading.UnknownPeriod.selector, PERIOD));
        ets.closePeriod(PERIOD);
    }

    function test_Revert_PeriodOf_Unknown() public {
        vm.expectRevert(abi.encodeWithSelector(IEmissionsTrading.UnknownPeriod.selector, PERIOD));
        ets.periodOf(PERIOD);
    }
}
