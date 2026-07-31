// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ColdChainMonitor } from "../../src/logistics/ColdChainMonitor.sol";
import { IColdChainMonitor } from "../../src/interfaces/IColdChainMonitor.sol";
import { IPolicyManager } from "../../src/interfaces/IPolicyManager.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { MockParametricInsurance } from "./mocks/MockParametricInsurance.sol";

contract ColdChainMonitorTest is Test {
    AddressBook internal book;
    ColdChainMonitor internal ccm;

    address internal admin = address(0xA11CE);
    address internal keeper = address(0xC0FFEE);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-cold-1");
    int256 internal constant MIN_T = 2;
    int256 internal constant MAX_T = 8;
    uint16 internal constant MAX_H = 8000; // 80%

    event ProfileSet(bytes32 indexed batchId, int256 minTemp, int256 maxTemp, uint16 maxHumidityBps);
    event ReadingRecorded(bytes32 indexed batchId, uint256 indexed index, int256 temp, uint16 humidityBps, bool breach);
    event Breached(bytes32 indexed batchId, int256 temp, uint16 humidityBps, uint32 breachCount);
    event ProfileClosed(bytes32 indexed batchId);
    event ParametricClaimTriggered(bytes32 indexed batchId, bytes32 indexed policyId, uint256 coverage);

    function setUp() public {
        book = new AddressBook(admin);
        ccm = new ColdChainMonitor(address(book), admin);
        vm.startPrank(admin);
        ccm.grantRole(Roles.KEEPER_ROLE, keeper);
        vm.stopPrank();
    }

    function _setProfile() internal {
        vm.prank(keeper);
        ccm.setProfile(BATCH, MIN_T, MAX_T, MAX_H);
    }

    // ---------------------------------------------------------------- profile

    function test_SetProfile_Happy() public {
        vm.expectEmit(true, false, false, true);
        emit ProfileSet(BATCH, MIN_T, MAX_T, MAX_H);
        _setProfile();

        IColdChainMonitor.Profile memory p = ccm.profileOf(BATCH);
        assertEq(p.minTemp, MIN_T);
        assertEq(p.maxTemp, MAX_T);
        assertEq(p.maxHumidityBps, MAX_H);
        assertTrue(p.active);
        assertFalse(p.breached);
    }

    function test_SetProfile_ByRegistrar() public {
        vm.prank(admin);
        ccm.grantRole(Roles.REGISTRAR_ROLE, stranger);
        vm.prank(stranger);
        ccm.setProfile(BATCH, MIN_T, MAX_T, MAX_H);
        assertTrue(ccm.profileOf(BATCH).active);
    }

    function test_Revert_SetProfile_Unauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.KEEPER_ROLE)
        );
        ccm.setProfile(BATCH, MIN_T, MAX_T, MAX_H);
    }

    function test_Revert_SetProfile_InvalidBand() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IColdChainMonitor.InvalidBand.selector, int256(9), int256(3)));
        ccm.setProfile(BATCH, 9, 3, MAX_H);
    }

    function test_Revert_SetProfile_Exists() public {
        _setProfile();
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IColdChainMonitor.ProfileExists.selector, BATCH));
        ccm.setProfile(BATCH, MIN_T, MAX_T, MAX_H);
    }

    // ---------------------------------------------------------------- readings

    function test_PushReading_InBand_NoBreach() public {
        _setProfile();
        vm.expectEmit(true, true, false, true);
        emit ReadingRecorded(BATCH, 0, 5, 5000, false);
        vm.prank(keeper);
        bool breach = ccm.pushReading(BATCH, 5, 5000, keccak256("d0"));

        assertFalse(breach);
        assertFalse(ccm.isBreached(BATCH));
        assertEq(ccm.readingCount(BATCH), 1);
        IColdChainMonitor.Reading memory r = ccm.readingAt(BATCH, 0);
        assertEq(r.temp, 5);
        assertFalse(r.breach);
    }

    function test_PushReading_OverTemp_Breach() public {
        _setProfile();
        vm.expectEmit(true, false, false, true);
        emit Breached(BATCH, 12, 5000, 1);
        vm.prank(keeper);
        bool breach = ccm.pushReading(BATCH, 12, 5000, keccak256("hot"));

        assertTrue(breach);
        assertTrue(ccm.isBreached(BATCH));
        assertEq(ccm.profileOf(BATCH).breachCount, 1);
    }

    function test_PushReading_OverHumidity_Breach() public {
        _setProfile();
        vm.prank(keeper);
        bool breach = ccm.pushReading(BATCH, 5, 9000, keccak256("wet"));
        assertTrue(breach);
        assertTrue(ccm.isBreached(BATCH));
    }

    function test_PushReading_UnderTemp_Breach() public {
        _setProfile();
        vm.prank(keeper);
        bool breach = ccm.pushReading(BATCH, -1, 5000, keccak256("froze"));
        assertTrue(breach);
    }

    function test_PushReading_MultipleBreachesCount() public {
        _setProfile();
        vm.startPrank(keeper);
        ccm.pushReading(BATCH, 12, 5000, keccak256("h1"));
        ccm.pushReading(BATCH, 13, 5000, keccak256("h2"));
        vm.stopPrank();
        assertEq(ccm.profileOf(BATCH).breachCount, 2);
        assertEq(ccm.readingCount(BATCH), 2);
    }

    function test_Revert_PushReading_NotKeeper() public {
        _setProfile();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.KEEPER_ROLE)
        );
        ccm.pushReading(BATCH, 5, 5000, keccak256("d"));
    }

    function test_Revert_PushReading_UnknownProfile() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IColdChainMonitor.UnknownProfile.selector, BATCH));
        ccm.pushReading(BATCH, 5, 5000, keccak256("d"));
    }

    function test_Revert_PushReading_Inactive() public {
        _setProfile();
        vm.prank(keeper);
        ccm.closeProfile(BATCH);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IColdChainMonitor.ProfileInactive.selector, BATCH));
        ccm.pushReading(BATCH, 5, 5000, keccak256("d"));
    }

    // ---------------------------------------------------------------- close

    function test_CloseProfile_Happy() public {
        _setProfile();
        vm.expectEmit(true, false, false, false);
        emit ProfileClosed(BATCH);
        vm.prank(keeper);
        ccm.closeProfile(BATCH);
        assertFalse(ccm.profileOf(BATCH).active);
    }

    // ---------------------------------------------------------------- parametric hook

    function test_ParametricPayout_FiledOnFirstBreach() public {
        MockParametricInsurance ins = new MockParametricInsurance();
        bytes32 policyId = keccak256("policy-1");
        ins.setPolicy(BATCH, policyId, 1_000e6, IPolicyManager.PolicyState.Active);

        vm.startPrank(admin);
        book.setAddress(Keys.POLICY_MANAGER, address(ins));
        book.setAddress(Keys.CLAIMS_PROCESSOR, address(ins));
        vm.stopPrank();

        _setProfile();

        vm.expectEmit(true, true, false, true);
        emit ParametricClaimTriggered(BATCH, policyId, 1_000e6);
        vm.prank(keeper);
        ccm.pushReading(BATCH, 15, 5000, keccak256("hot"));

        assertEq(ins.fileCount(), 1);
        assertEq(ins.lastAmount(), 1_000e6);

        // Second breach must NOT file a second claim (one-shot).
        vm.prank(keeper);
        ccm.pushReading(BATCH, 16, 5000, keccak256("hot2"));
        assertEq(ins.fileCount(), 1);
    }

    function test_ParametricPayout_NoPolicy_NoRevert() public {
        MockParametricInsurance ins = new MockParametricInsurance();
        vm.startPrank(admin);
        book.setAddress(Keys.POLICY_MANAGER, address(ins));
        book.setAddress(Keys.CLAIMS_PROCESSOR, address(ins));
        vm.stopPrank();

        _setProfile();
        // No policy configured for BATCH -> breach still records, no claim filed.
        vm.prank(keeper);
        ccm.pushReading(BATCH, 15, 5000, keccak256("hot"));
        assertTrue(ccm.isBreached(BATCH));
        assertEq(ins.fileCount(), 0);
    }

    function test_ParametricPayout_ClaimsRevert_DoesNotBlockReading() public {
        MockParametricInsurance ins = new MockParametricInsurance();
        ins.setPolicy(BATCH, keccak256("p"), 500e6, IPolicyManager.PolicyState.Active);
        ins.setShouldRevert(true);
        vm.startPrank(admin);
        book.setAddress(Keys.POLICY_MANAGER, address(ins));
        book.setAddress(Keys.CLAIMS_PROCESSOR, address(ins));
        vm.stopPrank();

        _setProfile();
        vm.prank(keeper);
        bool breach = ccm.pushReading(BATCH, 15, 5000, keccak256("hot"));
        assertTrue(breach);
        assertTrue(ccm.isBreached(BATCH));
        assertEq(ins.fileCount(), 0);
    }
}
