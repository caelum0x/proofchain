// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { BidManager } from "../../src/marketplace/BidManager.sol";
import { IBidManager } from "../../src/interfaces/IBidManager.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { ReenterERC20 } from "./mocks/ReenterERC20.sol";

contract BidManagerTest is Test {
    AddressBook internal book;
    BidManager internal bids;
    MockUSDC internal token;

    address internal admin = address(0xA11CE);
    address internal market = address(0x1A4E7); // holds MARKET_ROLE (stands in for AuctionHouse)
    address internal alice = address(0xA71CE);
    address internal bob = address(0xB0B);
    address internal seller = address(0x5E11E);
    address internal stranger = address(0xDEAD);

    uint256 internal constant AID = 1;
    uint256 internal constant AMOUNT = 1_000e6;

    event BidEscrowed(uint256 indexed auctionId, address indexed bidder, address token, uint256 amount);
    event BidRefunded(uint256 indexed auctionId, address indexed bidder, uint256 amount);

    function setUp() public {
        book = new AddressBook(admin);
        bids = new BidManager(address(book), admin);
        bytes32 _marketRole = bids.MARKET_ROLE();
        vm.prank(admin);
        bids.grantRole(_marketRole, market);

        token = new MockUSDC();
        token.mint(alice, AMOUNT);
        token.mint(bob, AMOUNT);
        vm.prank(alice);
        token.approve(address(bids), type(uint256).max);
        vm.prank(bob);
        token.approve(address(bids), type(uint256).max);
    }

    function _escrow(address bidder, uint256 amount) internal {
        vm.prank(market);
        bids.escrowBid(AID, bidder, address(token), amount);
    }

    // --- construction ---

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new BidManager(address(0), admin);
    }

    // --- escrowBid ---

    function test_EscrowBid_HappyPath() public {
        vm.expectEmit(true, true, false, true);
        emit BidEscrowed(AID, alice, address(token), AMOUNT);
        _escrow(alice, AMOUNT);

        assertEq(bids.escrowedOf(AID, alice), AMOUNT);
        assertEq(bids.escrowTokenOf(AID, alice), address(token));
        assertEq(token.balanceOf(address(bids)), AMOUNT);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_EscrowBid_RevertsUnauthorized() public {
        bytes32 _role = bids.MARKET_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        bids.escrowBid(AID, alice, address(token), AMOUNT);
    }

    function test_EscrowBid_RevertsZeroAmount() public {
        vm.prank(market);
        vm.expectRevert(IBidManager.ZeroAmount.selector);
        bids.escrowBid(AID, alice, address(token), 0);
    }

    function test_EscrowBid_RevertsZeroBidder() public {
        vm.prank(market);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        bids.escrowBid(AID, address(0), address(token), AMOUNT);
    }

    // --- refundBid ---

    function test_RefundBid_HappyPath() public {
        _escrow(alice, AMOUNT);
        vm.expectEmit(true, true, false, true);
        emit BidRefunded(AID, alice, AMOUNT);
        vm.prank(market);
        bids.refundBid(AID, alice);

        assertEq(bids.escrowedOf(AID, alice), 0);
        assertEq(token.balanceOf(alice), AMOUNT);
    }

    function test_RefundBid_RevertsNothingToRefund() public {
        vm.prank(market);
        vm.expectRevert(abi.encodeWithSelector(IBidManager.NothingToRefund.selector, AID, alice));
        bids.refundBid(AID, alice);
    }

    function test_RefundBid_RevertsUnauthorized() public {
        _escrow(alice, AMOUNT);
        bytes32 _role = bids.MARKET_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        bids.refundBid(AID, alice);
    }

    // --- settleBid ---

    function test_SettleBid_HappyPath() public {
        _escrow(alice, AMOUNT);
        vm.prank(market);
        uint256 released = bids.settleBid(AID, alice, seller);

        assertEq(released, AMOUNT);
        assertEq(bids.escrowedOf(AID, alice), 0);
        assertEq(token.balanceOf(seller), AMOUNT);
    }

    function test_SettleBid_RevertsNothing() public {
        vm.prank(market);
        vm.expectRevert(abi.encodeWithSelector(IBidManager.NothingToRefund.selector, AID, alice));
        bids.settleBid(AID, alice, seller);
    }

    function test_SettleBid_RevertsZeroTo() public {
        _escrow(alice, AMOUNT);
        vm.prank(market);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        bids.settleBid(AID, alice, address(0));
    }

    function test_SettleBid_RevertsUnauthorized() public {
        _escrow(alice, AMOUNT);
        bytes32 _role = bids.MARKET_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        bids.settleBid(AID, alice, seller);
    }

    function test_EscrowBid_AccumulatesAcrossAuctions() public {
        _escrow(alice, 400e6);
        vm.prank(market);
        bids.escrowBid(2, alice, address(token), 300e6);
        assertEq(bids.escrowedOf(AID, alice), 400e6);
        assertEq(bids.escrowedOf(2, alice), 300e6);
    }

    // --- reentrancy (money-movement safety) ---

    function test_RefundBid_ReentrancyBlocked() public {
        ReenterERC20 evil = new ReenterERC20();
        evil.mint(alice, AMOUNT);
        vm.prank(alice);
        evil.approve(address(bids), type(uint256).max);

        // Grant the malicious token MARKET_ROLE so its re-entrant refund call clears the access check
        // and actually reaches (and trips) the nonReentrant guard.
        bytes32 _marketRole = bids.MARKET_ROLE();
        vm.prank(admin);
        bids.grantRole(_marketRole, address(evil));

        vm.prank(market);
        bids.escrowBid(AID, alice, address(evil), AMOUNT);

        evil.arm(address(bids), abi.encodeWithSelector(bids.refundBid.selector, AID, alice));

        vm.prank(market);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        bids.refundBid(AID, alice);
    }
}
