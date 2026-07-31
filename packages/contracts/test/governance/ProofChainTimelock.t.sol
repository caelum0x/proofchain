// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";

import { ProofChainTimelock } from "../../src/governance/ProofChainTimelock.sol";
import { Box } from "./mocks/Box.sol";

contract ProofChainTimelockTest is Test {
    ProofChainTimelock internal timelock;
    Box internal box;

    address internal admin = address(0xA11CE);
    address internal proposer = address(0x9505E4);
    address internal executor = address(0xE8EC);

    uint256 internal constant MIN_DELAY = 2 days;

    function setUp() public {
        address[] memory proposers = new address[](1);
        proposers[0] = proposer;
        address[] memory executors = new address[](1);
        executors[0] = executor;
        timelock = new ProofChainTimelock(MIN_DELAY, proposers, executors, admin);
        box = new Box(address(timelock));
    }

    function test_Constructor_SetsDelayAndRoles() public view {
        assertEq(timelock.getMinDelay(), MIN_DELAY);
        assertTrue(timelock.hasRole(timelock.PROPOSER_ROLE(), proposer));
        assertTrue(timelock.hasRole(timelock.EXECUTOR_ROLE(), executor));
        assertTrue(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_ScheduleAndExecute_RoundTrip() public {
        bytes memory data = abi.encodeCall(Box.store, (777));
        bytes32 salt = bytes32(0);
        bytes32 predecessor = bytes32(0);

        vm.prank(proposer);
        timelock.schedule(address(box), 0, data, predecessor, salt, MIN_DELAY);

        bytes32 id = timelock.hashOperation(address(box), 0, data, predecessor, salt);
        assertTrue(timelock.isOperation(id));
        assertFalse(timelock.isOperationReady(id));

        // Cannot execute before the delay elapses.
        vm.prank(executor);
        vm.expectRevert();
        timelock.execute(address(box), 0, data, predecessor, salt);

        vm.warp(block.timestamp + MIN_DELAY + 1);
        assertTrue(timelock.isOperationReady(id));

        vm.prank(executor);
        timelock.execute(address(box), 0, data, predecessor, salt);

        assertTrue(timelock.isOperationDone(id));
        assertEq(box.value(), 777);
    }

    function test_Schedule_RevertsBelowMinDelay() public {
        bytes memory data = abi.encodeCall(Box.store, (1));
        vm.prank(proposer);
        vm.expectRevert();
        timelock.schedule(address(box), 0, data, bytes32(0), bytes32(0), MIN_DELAY - 1);
    }

    function test_Schedule_RevertsWhenNotProposer() public {
        bytes memory data = abi.encodeCall(Box.store, (1));
        vm.prank(address(0xBAD));
        vm.expectRevert();
        timelock.schedule(address(box), 0, data, bytes32(0), bytes32(0), MIN_DELAY);
    }
}
