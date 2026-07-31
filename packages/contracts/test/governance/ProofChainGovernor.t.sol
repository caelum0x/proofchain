// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IGovernor } from "@openzeppelin/contracts/governance/IGovernor.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { GovernanceToken } from "../../src/governance/GovernanceToken.sol";
import { ProofChainTimelock } from "../../src/governance/ProofChainTimelock.sol";
import { ProofChainGovernor } from "../../src/governance/ProofChainGovernor.sol";
import { Box } from "./mocks/Box.sol";

contract ProofChainGovernorTest is Test {
    AddressBook internal book;
    GovernanceToken internal token;
    ProofChainTimelock internal timelock;
    ProofChainGovernor internal governor;
    Box internal box;

    address internal admin = address(0xA11CE);
    address internal voter = address(0x501E);

    uint48 internal constant VOTING_DELAY = 1; // blocks
    uint32 internal constant VOTING_PERIOD = 10; // blocks
    uint256 internal constant PROPOSAL_THRESHOLD = 0;
    uint256 internal constant QUORUM_PERCENT = 4;
    uint256 internal constant MIN_DELAY = 1 days;

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        token = new GovernanceToken(admin, admin);

        address[] memory empty = new address[](0);
        // admin is bootstrap admin so it can grant PROPOSER/EXECUTOR to the governor after deploy.
        timelock = new ProofChainTimelock(MIN_DELAY, empty, empty, admin);

        book.setAddress(Keys.GOVERNANCE_TOKEN, address(token));
        book.setAddress(Keys.PROOFCHAIN_TIMELOCK, address(timelock));

        governor =
            new ProofChainGovernor(address(book), VOTING_DELAY, VOTING_PERIOD, PROPOSAL_THRESHOLD, QUORUM_PERCENT);
        book.setAddress(Keys.PROOFCHAIN_GOVERNOR, address(governor));

        // Wire timelock roles: governor proposes/cancels, anyone executes.
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.CANCELLER_ROLE(), address(governor));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(0));

        // Fund the voter and self-delegate BEFORE any proposal snapshot.
        token.mint(voter, 1000e18);
        vm.stopPrank();

        vm.prank(voter);
        token.delegate(voter);

        box = new Box(address(timelock));

        // Advance a block so the delegation checkpoint is in the past.
        vm.roll(block.number + 1);
    }

    function test_Constructor_WiresTokenAndTimelock() public view {
        assertEq(address(governor.token()), address(token));
        assertEq(governor.timelock(), address(timelock));
        assertEq(governor.votingDelay(), VOTING_DELAY);
        assertEq(governor.votingPeriod(), VOTING_PERIOD);
        assertEq(governor.proposalThreshold(), PROPOSAL_THRESHOLD);
    }

    function test_Quorum_IsFourPercentOfSupply() public view {
        // 4% of 1000e18 total supply.
        assertEq(governor.quorum(block.number - 1), 40e18);
    }

    function test_FullGovernanceRoundTrip() public {
        (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas,
            string memory description
        ) = _proposal(999);
        bytes32 descriptionHash = keccak256(bytes(description));

        vm.prank(voter);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Pending));

        // Move past the voting delay -> Active.
        vm.roll(block.number + VOTING_DELAY + 1);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Active));

        vm.prank(voter);
        governor.castVote(proposalId, 1); // 1 = For

        // Move past the voting period -> Succeeded.
        vm.roll(block.number + VOTING_PERIOD + 1);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Succeeded));

        governor.queue(targets, values, calldatas, descriptionHash);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Queued));

        vm.warp(block.timestamp + MIN_DELAY + 1);
        governor.execute(targets, values, calldatas, descriptionHash);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Executed));

        assertEq(box.value(), 999);
    }

    function test_Propose_DefeatedWithoutQuorum() public {
        // Give a tiny holder below quorum and vote For; proposal should be Defeated.
        address whale = address(0xBEEF);
        vm.startPrank(admin);
        token.mint(whale, 10e18); // 10e18 < 40e18 quorum
        vm.stopPrank();
        vm.prank(whale);
        token.delegate(whale);
        vm.roll(block.number + 1);

        (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas,
            string memory description
        ) = _proposal(123);

        vm.prank(whale);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);
        vm.roll(block.number + VOTING_DELAY + 1);
        vm.prank(whale);
        governor.castVote(proposalId, 1);
        vm.roll(block.number + VOTING_PERIOD + 1);

        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Defeated));
    }

    function _proposal(uint256 newValue)
        internal
        view
        returns (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas,
            string memory description
        )
    {
        targets = new address[](1);
        targets[0] = address(box);
        values = new uint256[](1);
        values[0] = 0;
        calldatas = new bytes[](1);
        calldatas[0] = abi.encodeCall(Box.store, (newValue));
        description = string.concat("Set box value to ", vm.toString(newValue));
    }
}
