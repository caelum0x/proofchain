// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { StakeManager } from "../../src/reputation/StakeManager.sol";
import { ArbiterStaking } from "../../src/governance/ArbiterStaking.sol";
import { DisputeArbitration } from "../../src/governance/DisputeArbitration.sol";
import { IDisputeArbitration } from "../../src/interfaces/IDisputeArbitration.sol";
import { ISettlementEscrow } from "../../src/interfaces/ISettlementEscrow.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockSettlementEscrow } from "./mocks/MockSettlementEscrow.sol";

contract DisputeArbitrationTest is Test {
    AddressBook internal book;
    StakeManager internal sm;
    ArbiterStaking internal arb;
    DisputeArbitration internal disp;
    MockSettlementEscrow internal escrow;
    MockUSDC internal token;

    address internal admin = address(0xA11CE);
    address internal treasury = address(0x7EA);
    address internal buyer = address(0xB4E4);
    address internal supplier = address(0x5099);

    address internal alice = address(0xA11);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);
    address internal stranger = address(0xDEAD);

    uint256 internal constant MIN_STAKE = 100e6;
    uint256 internal constant DEAL_AMOUNT = 1_000e6;
    uint64 internal constant VOTING_PERIOD = 1 days;
    uint256 internal constant SLASH_PENALTY = 40e6;

    bytes32 internal constant BATCH = keccak256("BATCH_DISPUTED");

    event DisputeOpened(bytes32 indexed batchId, address indexed opener);
    event Voted(bytes32 indexed batchId, address indexed arbiter, bool refundBuyer);
    event Resolved(bytes32 indexed batchId, bool refundedBuyer);
    event ArbiterSlashed(bytes32 indexed batchId, address indexed arbiter, uint256 amount);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        sm = new StakeManager(address(book), admin);
        arb = new ArbiterStaking(address(book), admin, MIN_STAKE);
        escrow = new MockSettlementEscrow();
        disp = new DisputeArbitration(address(book), admin, VOTING_PERIOD, SLASH_PENALTY);

        book.setAddress(Keys.STAKE_MANAGER, address(sm));
        book.setAddress(Keys.ARBITER_STAKING, address(arb));
        book.setAddress(Keys.DISPUTE_ARBITRATION, address(disp));
        book.setAddress(Keys.SETTLEMENT_ESCROW, address(escrow));
        book.setAddress(Keys.TREASURY, treasury);

        sm.grantRole(sm.STAKE_CONTROLLER_ROLE(), address(arb));
        sm.grantRole(Roles.SLASHER_ROLE, address(disp)); // disp seizes losing-voter stake
        vm.stopPrank();

        token = new MockUSDC();

        // Register arbiters with committed stake.
        _becomeArbiter(alice);
        _becomeArbiter(bob);
        _becomeArbiter(carol);

        // Escrow a disputed deal funded from this test contract.
        token.mint(address(this), DEAL_AMOUNT);
        token.approve(address(escrow), DEAL_AMOUNT);
        escrow.seedDisputed(BATCH, buyer, supplier, address(token), DEAL_AMOUNT);
    }

    function _becomeArbiter(address who) internal {
        token.mint(who, 300e6);
        vm.startPrank(who);
        token.approve(address(sm), type(uint256).max);
        sm.stake(address(token), 300e6);
        arb.stakeArbiter(MIN_STAKE);
        vm.stopPrank();
    }

    function _open() internal {
        disp.openDispute(BATCH);
    }

    function _vote(address who, bool refundBuyer) internal {
        vm.prank(who);
        disp.vote(BATCH, refundBuyer);
    }

    // --- construction ---

    function test_Constructor_RevertsZeroVotingPeriod() public {
        vm.expectRevert(DisputeArbitration.ZeroVotingPeriod.selector);
        new DisputeArbitration(address(book), admin, 0, 0);
    }

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new DisputeArbitration(address(0), admin, VOTING_PERIOD, 0);
    }

    // --- openDispute ---

    function test_OpenDispute_HappyPath() public {
        vm.expectEmit(true, true, false, true);
        emit DisputeOpened(BATCH, address(this));
        _open();

        IDisputeArbitration.Dispute memory d = disp.disputeOf(BATCH);
        assertEq(uint256(d.state), uint256(IDisputeArbitration.DisputeState.Open));
        assertEq(d.openedAt, uint64(block.timestamp));
    }

    function test_OpenDispute_RevertsDisputeExists() public {
        _open();
        vm.expectRevert(abi.encodeWithSelector(IDisputeArbitration.DisputeExists.selector, BATCH));
        _open();
    }

    function test_OpenDispute_RevertsWhenDealNotDisputed() public {
        bytes32 other = keccak256("NO_DEAL");
        vm.expectRevert(abi.encodeWithSelector(DisputeArbitration.NotDisputedDeal.selector, other));
        disp.openDispute(other);
    }

    // --- vote ---

    function test_Vote_HappyPath() public {
        _open();
        vm.expectEmit(true, true, false, true);
        emit Voted(BATCH, alice, false);
        _vote(alice, false);

        IDisputeArbitration.Dispute memory d = disp.disputeOf(BATCH);
        assertEq(d.votesRelease, 1);
        assertEq(d.votesRefund, 0);
        assertTrue(disp.hasVoted(BATCH, alice));
        assertEq(disp.voterCount(BATCH), 1);
        // Casting a vote locks the arbiter's stake.
        assertEq(arb.pendingVotesOf(alice), 1);
    }

    function test_Vote_RevertsNotArbiter() public {
        _open();
        vm.expectRevert(abi.encodeWithSelector(IDisputeArbitration.NotArbiter.selector, stranger));
        _vote(stranger, true);
    }

    function test_Vote_RevertsAlreadyVoted() public {
        _open();
        _vote(alice, false);
        vm.expectRevert(abi.encodeWithSelector(IDisputeArbitration.AlreadyVoted.selector, BATCH, alice));
        _vote(alice, true);
    }

    function test_Vote_RevertsWhenDisputeNotOpen() public {
        // Never opened.
        vm.expectRevert(abi.encodeWithSelector(IDisputeArbitration.DisputeNotOpen.selector, BATCH));
        _vote(alice, true);
    }

    // --- resolve ---

    function test_Resolve_RevertsVotingOngoing() public {
        _open();
        _vote(alice, true);
        vm.expectRevert(abi.encodeWithSelector(IDisputeArbitration.VotingOngoing.selector, BATCH));
        disp.resolve(BATCH);
    }

    function test_Resolve_RevertsNoVotes() public {
        _open();
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        vm.expectRevert(abi.encodeWithSelector(DisputeArbitration.NoVotes.selector, BATCH));
        disp.resolve(BATCH);
    }

    function test_Resolve_RefundsBuyerOnMajority() public {
        _open();
        _vote(alice, true); // refund
        _vote(bob, true); // refund
        _vote(carol, false); // release (minority)

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        uint256 buyerBefore = token.balanceOf(buyer);
        vm.expectEmit(true, false, false, true);
        emit Resolved(BATCH, true);
        disp.resolve(BATCH);

        // Buyer refunded the full escrowed amount.
        assertEq(token.balanceOf(buyer), buyerBefore + DEAL_AMOUNT);
        assertEq(uint256(escrow.getDeal(BATCH).state), uint256(ISettlementEscrow.DealState.Refunded));

        IDisputeArbitration.Dispute memory d = disp.disputeOf(BATCH);
        assertEq(uint256(d.state), uint256(IDisputeArbitration.DisputeState.Resolved));
        assertTrue(d.refundedBuyer);

        // Minority voter (carol, voted release) was slashed; majority untouched.
        assertEq(arb.stakeOf(carol), MIN_STAKE - SLASH_PENALTY);
        assertEq(arb.stakeOf(alice), MIN_STAKE);
        assertEq(token.balanceOf(treasury), SLASH_PENALTY);

        // Vote locks released for all voters.
        assertEq(arb.pendingVotesOf(alice), 0);
        assertEq(arb.pendingVotesOf(carol), 0);
    }

    function test_Resolve_ReleasesToSupplierOnMajority() public {
        _open();
        _vote(alice, false); // release
        _vote(bob, false); // release
        _vote(carol, true); // refund (minority)

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        uint256 supplierBefore = token.balanceOf(supplier);
        disp.resolve(BATCH);

        assertEq(token.balanceOf(supplier), supplierBefore + DEAL_AMOUNT);
        assertEq(uint256(escrow.getDeal(BATCH).state), uint256(ISettlementEscrow.DealState.Released));
        assertFalse(disp.disputeOf(BATCH).refundedBuyer);

        // carol (minority) slashed.
        assertEq(arb.stakeOf(carol), MIN_STAKE - SLASH_PENALTY);
        assertEq(token.balanceOf(treasury), SLASH_PENALTY);
    }

    function test_Resolve_TieFavorsBuyerRefund() public {
        _open();
        _vote(alice, true); // refund
        _vote(bob, false); // release
        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        disp.resolve(BATCH);
        assertTrue(disp.disputeOf(BATCH).refundedBuyer);
        assertEq(uint256(escrow.getDeal(BATCH).state), uint256(ISettlementEscrow.DealState.Refunded));
    }

    function test_Resolve_RevertsWhenAlreadyResolved() public {
        _open();
        _vote(alice, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        disp.resolve(BATCH);

        vm.expectRevert(abi.encodeWithSelector(IDisputeArbitration.DisputeNotOpen.selector, BATCH));
        disp.resolve(BATCH);
    }

    function test_Resolve_UnstakePossibleAfterResolution() public {
        _open();
        _vote(alice, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        disp.resolve(BATCH);

        // Lock released -> alice can now unstake her arbiter commitment.
        vm.prank(alice);
        arb.unstakeArbiter(MIN_STAKE);
        assertEq(arb.stakeOf(alice), 0);
    }

    function test_Resolve_NoSlashWhenPenaltyZero() public {
        vm.prank(admin);
        disp.setSlashPenalty(0);

        _open();
        _vote(alice, false);
        _vote(bob, true); // minority
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        disp.resolve(BATCH);

        // No slashing occurred.
        assertEq(arb.stakeOf(bob), MIN_STAKE);
        assertEq(token.balanceOf(treasury), 0);
    }

    // --- admin ---

    function test_SetVotingPeriod_AdminOnly() public {
        vm.prank(admin);
        disp.setVotingPeriod(2 days);
        assertEq(disp.votingPeriod(), 2 days);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, disp.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(stranger);
        disp.setVotingPeriod(3 days);
    }

    function test_SetVotingPeriod_RevertsZero() public {
        vm.prank(admin);
        vm.expectRevert(DisputeArbitration.ZeroVotingPeriod.selector);
        disp.setVotingPeriod(0);
    }

    function test_SetSlashPenalty_AdminOnly() public {
        vm.prank(admin);
        disp.setSlashPenalty(99e6);
        assertEq(disp.slashPenalty(), 99e6);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, disp.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(stranger);
        disp.setSlashPenalty(1);
    }
}
