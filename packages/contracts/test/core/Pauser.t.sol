// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { Pauser } from "../../src/core/Pauser.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract PauserTest is Test {
    Pauser internal pauser;
    address internal admin = address(0xA11CE);
    address internal stranger = address(0xBEEF);

    event Paused(address indexed account);
    event Unpaused(address indexed account);

    function setUp() public {
        pauser = new Pauser(admin);
    }

    function test_Constructor_RevertsZeroAdmin() public {
        vm.expectRevert(Pauser.ZeroAddress.selector);
        new Pauser(address(0));
    }

    function test_InitiallyUnpaused() public view {
        assertFalse(pauser.paused());
        pauser.requireNotPaused();
    }

    function test_Pause_EmitsAndBlocks() public {
        vm.expectEmit(true, false, false, false);
        emit Paused(admin);
        vm.prank(admin);
        pauser.pause();

        assertTrue(pauser.paused());
        vm.expectRevert(IPauser.EnforcedPause.selector);
        pauser.requireNotPaused();
    }

    function test_Unpause_RoundTrip() public {
        vm.startPrank(admin);
        pauser.pause();
        vm.expectEmit(true, false, false, false);
        emit Unpaused(admin);
        pauser.unpause();
        vm.stopPrank();
        assertFalse(pauser.paused());
        pauser.requireNotPaused();
    }

    function test_Pause_RevertsWhenAlreadyPaused() public {
        vm.startPrank(admin);
        pauser.pause();
        vm.expectRevert(IPauser.ExpectedPause.selector);
        pauser.pause();
        vm.stopPrank();
    }

    function test_Unpause_RevertsWhenNotPaused() public {
        vm.prank(admin);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        pauser.unpause();
    }

    function test_Pause_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.PAUSER_ROLE
            )
        );
        pauser.pause();
    }
}
