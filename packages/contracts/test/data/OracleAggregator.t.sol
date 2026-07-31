// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { OracleAggregator } from "../../src/data/OracleAggregator.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IOracleAggregator } from "../../src/interfaces/IOracleAggregator.sol";

contract OracleAggregatorTest is Test {
    AddressBook internal book;
    OracleAggregator internal agg;

    address internal admin = address(0xA11CE);
    address internal keeper = address(0x33D);
    address internal r1 = address(0xA1);
    address internal r2 = address(0xA2);
    address internal r3 = address(0xA3);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant FEED = keccak256("TEMP-BATCH-1");

    event FeedConfigured(bytes32 indexed feedId, uint8 minQuorum);
    event Submitted(bytes32 indexed feedId, uint64 indexed roundId, address indexed reporter, uint256 value);
    event RoundFinalized(bytes32 indexed feedId, uint64 indexed roundId, uint256 answer, uint8 submissionCount);

    function setUp() public {
        book = new AddressBook(admin);
        agg = new OracleAggregator(address(book), admin);
        vm.startPrank(admin);
        agg.grantRole(Roles.KEEPER_ROLE, keeper);
        vm.stopPrank();
    }

    function _configureWithReporters(uint8 quorum) internal {
        vm.startPrank(keeper);
        agg.configureFeed(FEED, quorum);
        agg.addReporter(FEED, r1);
        agg.addReporter(FEED, r2);
        agg.addReporter(FEED, r3);
        vm.stopPrank();
    }

    function test_ConfigureFeed_HappyPath() public {
        vm.expectEmit(true, false, false, true, address(agg));
        emit FeedConfigured(FEED, 2);
        vm.prank(keeper);
        agg.configureFeed(FEED, 2);

        IOracleAggregator.FeedConfig memory f = agg.feedConfigOf(FEED);
        assertEq(f.minQuorum, 2);
        assertEq(f.roundId, 1);
        assertTrue(f.active);
    }

    function test_RevertWhen_ConfigureByStranger() public {
        vm.prank(stranger);
        vm.expectRevert();
        agg.configureFeed(FEED, 2);
    }

    function test_RevertWhen_ZeroQuorum() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IOracleAggregator.InvalidQuorum.selector, uint8(0)));
        agg.configureFeed(FEED, 0);
    }

    function test_RevertWhen_FeedExists() public {
        vm.startPrank(keeper);
        agg.configureFeed(FEED, 2);
        vm.expectRevert(abi.encodeWithSelector(IOracleAggregator.FeedExists.selector, FEED));
        agg.configureFeed(FEED, 3);
        vm.stopPrank();
    }

    function test_AddRemoveReporter() public {
        vm.startPrank(keeper);
        agg.configureFeed(FEED, 1);
        agg.addReporter(FEED, r1);
        assertTrue(agg.isReporter(FEED, r1));
        assertEq(agg.feedConfigOf(FEED).reporterCount, 1);

        agg.removeReporter(FEED, r1);
        assertFalse(agg.isReporter(FEED, r1));
        assertEq(agg.feedConfigOf(FEED).reporterCount, 0);
        vm.stopPrank();
    }

    function test_RevertWhen_AddDuplicateReporter() public {
        vm.startPrank(keeper);
        agg.configureFeed(FEED, 1);
        agg.addReporter(FEED, r1);
        vm.expectRevert(abi.encodeWithSelector(IOracleAggregator.ReporterExists.selector, FEED, r1));
        agg.addReporter(FEED, r1);
        vm.stopPrank();
    }

    function test_RevertWhen_RemoveUnknownReporter() public {
        vm.startPrank(keeper);
        agg.configureFeed(FEED, 1);
        vm.expectRevert(abi.encodeWithSelector(IOracleAggregator.NotReporter.selector, FEED, r1));
        agg.removeReporter(FEED, r1);
        vm.stopPrank();
    }

    function test_Submit_And_FinalizeMedian_Odd() public {
        _configureWithReporters(3);

        vm.prank(r1);
        agg.submit(FEED, 100);
        vm.expectEmit(true, true, true, true, address(agg));
        emit Submitted(FEED, 1, r2, 200);
        vm.prank(r2);
        agg.submit(FEED, 200);
        vm.prank(r3);
        agg.submit(FEED, 150);

        vm.expectEmit(true, true, false, true, address(agg));
        emit RoundFinalized(FEED, 1, 150, 3);
        agg.finalizeRound(FEED);

        (uint256 answer, uint64 roundId) = agg.latestAnswer(FEED);
        assertEq(answer, 150); // median of {100,150,200}
        assertEq(roundId, 1);

        // Next round is open.
        assertEq(agg.feedConfigOf(FEED).roundId, 2);
        assertEq(uint8(agg.roundOf(FEED, 1).state), uint8(IOracleAggregator.RoundState.Finalized));
        assertEq(uint8(agg.roundOf(FEED, 2).state), uint8(IOracleAggregator.RoundState.Collecting));
    }

    function test_FinalizeMedian_Even_TakesUpperMiddle() public {
        vm.startPrank(keeper);
        agg.configureFeed(FEED, 2);
        agg.addReporter(FEED, r1);
        agg.addReporter(FEED, r2);
        vm.stopPrank();

        vm.prank(r1);
        agg.submit(FEED, 40);
        vm.prank(r2);
        agg.submit(FEED, 60);
        agg.finalizeRound(FEED);

        (uint256 answer,) = agg.latestAnswer(FEED);
        assertEq(answer, 60); // arr[n/2] = arr[1] of sorted {40,60}
    }

    function test_RevertWhen_SubmitByNonReporter() public {
        _configureWithReporters(2);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IOracleAggregator.NotReporter.selector, FEED, stranger));
        agg.submit(FEED, 1);
    }

    function test_RevertWhen_DoubleSubmit() public {
        _configureWithReporters(2);
        vm.startPrank(r1);
        agg.submit(FEED, 100);
        vm.expectRevert(abi.encodeWithSelector(IOracleAggregator.AlreadySubmitted.selector, FEED, uint64(1), r1));
        agg.submit(FEED, 101);
        vm.stopPrank();
    }

    function test_RevertWhen_QuorumNotMet() public {
        _configureWithReporters(3);
        vm.prank(r1);
        agg.submit(FEED, 100);
        vm.expectRevert(abi.encodeWithSelector(IOracleAggregator.QuorumNotMet.selector, FEED, uint8(1), uint8(3)));
        agg.finalizeRound(FEED);
    }

    function test_RevertWhen_LatestAnswerNoFinalizedRound() public {
        _configureWithReporters(2);
        vm.expectRevert(abi.encodeWithSelector(IOracleAggregator.NoFinalizedRound.selector, FEED));
        agg.latestAnswer(FEED);
    }

    function test_RevertWhen_SubmitUnknownFeed() public {
        vm.prank(r1);
        vm.expectRevert(abi.encodeWithSelector(IOracleAggregator.UnknownFeed.selector, FEED));
        agg.submit(FEED, 1);
    }

    function test_MultiRound_IndependentSubmissions() public {
        _configureWithReporters(2);
        // Round 1
        vm.prank(r1);
        agg.submit(FEED, 10);
        vm.prank(r2);
        agg.submit(FEED, 20);
        agg.finalizeRound(FEED);
        // Round 2 — same reporters can submit again.
        vm.prank(r1);
        agg.submit(FEED, 30);
        vm.prank(r2);
        agg.submit(FEED, 50);
        agg.finalizeRound(FEED);

        (uint256 answer, uint64 roundId) = agg.latestAnswer(FEED);
        assertEq(answer, 50);
        assertEq(roundId, 2);
    }
}
