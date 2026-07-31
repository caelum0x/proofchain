// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { AuctionHouse } from "../../src/marketplace/AuctionHouse.sol";
import { BidManager } from "../../src/marketplace/BidManager.sol";
import { IAuctionHouse } from "../../src/interfaces/IAuctionHouse.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockERC721 } from "./mocks/MockERC721.sol";
import { ReenterERC20 } from "./mocks/ReenterERC20.sol";

contract AuctionHouseTest is Test {
    AddressBook internal book;
    BidManager internal bids;
    AuctionHouse internal house;
    MockUSDC internal token;
    MockERC721 internal nft;

    address internal admin = address(0xA11CE);
    address internal seller = address(0x5E11E);
    address internal alice = address(0xA71CE);
    address internal bob = address(0xB0B);
    address internal stranger = address(0xDEAD);

    uint256 internal constant TOKEN_ID = 42;
    uint256 internal constant RESERVE = 100e6;
    uint64 internal constant DURATION = 1 days;

    event AuctionStarted(
        uint256 indexed auctionId, address indexed nft, uint256 indexed tokenId, address seller, uint64 endTime
    );
    event Bid(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event Settled(uint256 indexed auctionId, address indexed winner, uint256 amount);

    function setUp() public {
        book = new AddressBook(admin);
        bids = new BidManager(address(book), admin);
        house = new AuctionHouse(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.BID_MANAGER, address(bids));
        book.setAddress(Keys.AUCTION_HOUSE, address(house));
        bids.grantRole(bids.MARKET_ROLE(), address(house));
        vm.stopPrank();

        nft = new MockERC721();
        nft.mint(seller, TOKEN_ID);
        vm.prank(seller);
        nft.setApprovalForAll(address(house), true);

        token = new MockUSDC();
        token.mint(alice, 10_000e6);
        token.mint(bob, 10_000e6);
        vm.prank(alice);
        token.approve(address(bids), type(uint256).max);
        vm.prank(bob);
        token.approve(address(bids), type(uint256).max);
    }

    function _start() internal returns (uint256) {
        vm.prank(seller);
        return house.startAuction(address(nft), TOKEN_ID, address(token), RESERVE, DURATION);
    }

    // --- construction ---

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new AuctionHouse(address(0), admin);
    }

    // --- startAuction ---

    function test_StartAuction_HappyPath() public {
        vm.expectEmit(true, true, true, true);
        emit AuctionStarted(1, address(nft), TOKEN_ID, seller, uint64(block.timestamp) + DURATION);
        uint256 id = _start();

        assertEq(id, 1);
        assertEq(nft.ownerOf(TOKEN_ID), address(house)); // escrowed
        IAuctionHouse.Auction memory a = house.auctionOf(id);
        assertEq(a.seller, seller);
        assertEq(a.reservePrice, RESERVE);
        assertEq(uint256(a.state), uint256(IAuctionHouse.AuctionState.Active));
    }

    function test_StartAuction_RevertsZeroNft() public {
        vm.prank(seller);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        house.startAuction(address(0), TOKEN_ID, address(token), RESERVE, DURATION);
    }

    function test_StartAuction_RevertsZeroPaymentToken() public {
        vm.prank(seller);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        house.startAuction(address(nft), TOKEN_ID, address(0), RESERVE, DURATION);
    }

    function test_StartAuction_RevertsZeroDuration() public {
        vm.prank(seller);
        vm.expectRevert(AuctionHouse.ZeroDuration.selector);
        house.startAuction(address(nft), TOKEN_ID, address(token), RESERVE, 0);
    }

    function test_StartAuction_RevertsNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(); // ERC721 not owner/approved
        house.startAuction(address(nft), TOKEN_ID, address(token), RESERVE, DURATION);
    }

    // --- bid ---

    function test_Bid_HappyPath() public {
        uint256 id = _start();
        vm.expectEmit(true, true, false, true);
        emit Bid(id, alice, RESERVE);
        vm.prank(alice);
        house.bid(id, RESERVE);

        IAuctionHouse.Auction memory a = house.auctionOf(id);
        assertEq(a.highestBidder, alice);
        assertEq(a.highestBid, RESERVE);
        assertEq(bids.escrowedOf(id, alice), RESERVE);
        assertEq(token.balanceOf(address(bids)), RESERVE);
    }

    function test_Bid_OutbidRefundsPrevious() public {
        uint256 id = _start();
        vm.prank(alice);
        house.bid(id, RESERVE);

        vm.prank(bob);
        house.bid(id, RESERVE + 50e6);

        // Alice fully refunded, bob's funds now escrowed.
        assertEq(bids.escrowedOf(id, alice), 0);
        assertEq(token.balanceOf(alice), 10_000e6);
        assertEq(bids.escrowedOf(id, bob), RESERVE + 50e6);
        assertEq(house.auctionOf(id).highestBidder, bob);
    }

    function test_Bid_SelfRaiseNetsDelta() public {
        uint256 id = _start();
        vm.startPrank(alice);
        house.bid(id, RESERVE);
        house.bid(id, RESERVE + 20e6);
        vm.stopPrank();

        // Only the latest bid remains escrowed; alice paid net the higher amount.
        assertEq(bids.escrowedOf(id, alice), RESERVE + 20e6);
        assertEq(token.balanceOf(alice), 10_000e6 - (RESERVE + 20e6));
    }

    function test_Bid_RevertsBelowReserve() public {
        uint256 id = _start();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAuctionHouse.BidTooLow.selector, id, RESERVE - 1, RESERVE));
        house.bid(id, RESERVE - 1);
    }

    function test_Bid_RevertsNotAboveHighest() public {
        uint256 id = _start();
        vm.prank(alice);
        house.bid(id, RESERVE + 10e6);
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAuctionHouse.BidTooLow.selector, id, RESERVE + 10e6, RESERVE + 10e6 + 1)
        );
        house.bid(id, RESERVE + 10e6);
    }

    function test_Bid_RevertsUnknownAuction() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAuctionHouse.UnknownAuction.selector, 99));
        house.bid(99, RESERVE);
    }

    function test_Bid_RevertsAfterEnd() public {
        uint256 id = _start();
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAuctionHouse.AuctionEnded.selector, id));
        house.bid(id, RESERVE);
    }

    // --- settleAuction ---

    function test_SettleAuction_WithWinner() public {
        uint256 id = _start();
        vm.prank(alice);
        house.bid(id, RESERVE);
        vm.prank(bob);
        house.bid(id, RESERVE + 100e6);

        vm.warp(block.timestamp + DURATION + 1);
        vm.expectEmit(true, true, false, true);
        emit Settled(id, bob, RESERVE + 100e6);
        house.settleAuction(id);

        assertEq(nft.ownerOf(TOKEN_ID), bob); // winner gets NFT
        assertEq(token.balanceOf(seller), RESERVE + 100e6); // seller paid
        assertEq(bids.escrowedOf(id, bob), 0);
        assertEq(uint256(house.auctionOf(id).state), uint256(IAuctionHouse.AuctionState.Settled));
    }

    function test_SettleAuction_NoBidsReturnsNft() public {
        uint256 id = _start();
        vm.warp(block.timestamp + DURATION + 1);
        vm.expectEmit(true, true, false, true);
        emit Settled(id, address(0), 0);
        house.settleAuction(id);

        assertEq(nft.ownerOf(TOKEN_ID), seller); // returned to seller
    }

    function test_SettleAuction_RevertsBeforeEnd() public {
        uint256 id = _start();
        vm.prank(alice);
        house.bid(id, RESERVE);
        vm.expectRevert(abi.encodeWithSelector(AuctionHouse.NotEnded.selector, id));
        house.settleAuction(id);
    }

    function test_SettleAuction_RevertsDoubleSettle() public {
        uint256 id = _start();
        vm.warp(block.timestamp + DURATION + 1);
        house.settleAuction(id);
        vm.expectRevert(abi.encodeWithSelector(IAuctionHouse.AuctionNotActive.selector, id));
        house.settleAuction(id);
    }

    function test_SettleAuction_RevertsUnknown() public {
        vm.expectRevert(abi.encodeWithSelector(IAuctionHouse.UnknownAuction.selector, 5));
        house.settleAuction(5);
    }

    // --- reentrancy (money-movement safety) ---

    function test_Bid_ReentrancyBlockedViaRefund() public {
        // Use a malicious payment token; when the outbid refund pays the previous leader, the token
        // tries to re-enter AuctionHouse.bid — the nonReentrant guard must block it.
        ReenterERC20 evil = new ReenterERC20();
        evil.mint(alice, 10_000e6);
        evil.mint(bob, 10_000e6);
        vm.prank(alice);
        evil.approve(address(bids), type(uint256).max);
        vm.prank(bob);
        evil.approve(address(bids), type(uint256).max);

        vm.prank(seller);
        uint256 id = house.startAuction(address(nft), TOKEN_ID, address(evil), RESERVE, DURATION);

        vm.prank(alice);
        house.bid(id, RESERVE);

        // Arm the token so alice's refund (triggered by bob's higher bid) re-enters bid().
        evil.arm(address(house), abi.encodeWithSelector(house.bid.selector, id, RESERVE + 200e6));

        vm.prank(bob);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        house.bid(id, RESERVE + 100e6);
    }
}
