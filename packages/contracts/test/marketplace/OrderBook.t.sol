// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { OrderBook } from "../../src/marketplace/OrderBook.sol";
import { IOrderBook } from "../../src/interfaces/IOrderBook.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockERC1155 } from "./mocks/MockERC1155.sol";
import { ReenterERC20 } from "./mocks/ReenterERC20.sol";

contract OrderBookTest is Test {
    AddressBook internal book;
    OrderBook internal orders;
    MockUSDC internal token;
    MockERC1155 internal asset;

    address internal admin = address(0xA11CE);
    address internal seller = address(0x5E11E);
    address internal buyer = address(0xB0B);
    address internal stranger = address(0xDEAD);

    uint256 internal constant ASSET_ID = 7;
    uint256 internal constant SELL_PRICE = 5e6;
    uint256 internal constant BUY_PRICE = 6e6;

    event OrderPlaced(
        uint256 indexed orderId, IOrderBook.Side side, address indexed maker, address asset, uint256 price, uint256 quantity
    );
    event OrderMatched(uint256 indexed buyOrderId, uint256 indexed sellOrderId, uint256 quantity, uint256 price);
    event OrderCancelled(uint256 indexed orderId);

    function setUp() public {
        book = new AddressBook(admin);
        orders = new OrderBook(address(book), admin);

        asset = new MockERC1155();
        asset.mint(seller, ASSET_ID, 1000);
        vm.prank(seller);
        asset.setApprovalForAll(address(orders), true);

        token = new MockUSDC();
        token.mint(buyer, 100_000e6);
        vm.prank(buyer);
        token.approve(address(orders), type(uint256).max);
    }

    function _sell(uint256 price, uint256 qty) internal returns (uint256) {
        vm.prank(seller);
        return orders.placeOrder(IOrderBook.Side.Sell, address(asset), ASSET_ID, address(token), price, qty);
    }

    function _buy(uint256 price, uint256 qty) internal returns (uint256) {
        vm.prank(buyer);
        return orders.placeOrder(IOrderBook.Side.Buy, address(asset), ASSET_ID, address(token), price, qty);
    }

    // --- construction ---

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new OrderBook(address(0), admin);
    }

    // --- placeOrder ---

    function test_PlaceSell_EscrowsAsset() public {
        vm.expectEmit(true, true, false, true);
        emit OrderPlaced(1, IOrderBook.Side.Sell, seller, address(asset), SELL_PRICE, 100);
        uint256 id = _sell(SELL_PRICE, 100);

        assertEq(asset.balanceOf(address(orders), ASSET_ID), 100);
        assertEq(asset.balanceOf(seller, ASSET_ID), 900);
        assertEq(uint256(orders.orderOf(id).side), uint256(IOrderBook.Side.Sell));
    }

    function test_PlaceBuy_EscrowsPayment() public {
        uint256 id = _buy(BUY_PRICE, 40);
        assertEq(token.balanceOf(address(orders)), BUY_PRICE * 40);
        assertEq(orders.orderOf(id).maker, buyer);
    }

    function test_PlaceOrder_RevertsZeroPrice() public {
        vm.prank(seller);
        vm.expectRevert(IOrderBook.ZeroPrice.selector);
        orders.placeOrder(IOrderBook.Side.Sell, address(asset), ASSET_ID, address(token), 0, 10);
    }

    function test_PlaceOrder_RevertsZeroQuantity() public {
        vm.prank(seller);
        vm.expectRevert(IOrderBook.ZeroQuantity.selector);
        orders.placeOrder(IOrderBook.Side.Sell, address(asset), ASSET_ID, address(token), SELL_PRICE, 0);
    }

    function test_PlaceOrder_RevertsZeroAsset() public {
        vm.prank(seller);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        orders.placeOrder(IOrderBook.Side.Sell, address(0), ASSET_ID, address(token), SELL_PRICE, 10);
    }

    // --- matchOrders ---

    function test_MatchOrders_FullFillWithPriceImprovement() public {
        uint256 sellId = _sell(SELL_PRICE, 100);
        uint256 buyId = _buy(BUY_PRICE, 40);

        vm.expectEmit(true, true, false, true);
        emit OrderMatched(buyId, sellId, 40, SELL_PRICE);
        orders.matchOrders(buyId, sellId);

        // Buyer receives 40 units, seller receives 40*SELL_PRICE, buyer refunded the improvement.
        assertEq(asset.balanceOf(buyer, ASSET_ID), 40);
        assertEq(token.balanceOf(seller), 40 * SELL_PRICE);
        uint256 spent = 40 * SELL_PRICE;
        assertEq(token.balanceOf(buyer), 100_000e6 - spent);

        assertEq(orders.orderOf(buyId).filled, 40); // buy fully filled
        assertEq(orders.orderOf(sellId).filled, 40); // sell partially filled
    }

    function test_MatchOrders_PartialThenRemainderCancellable() public {
        uint256 sellId = _sell(SELL_PRICE, 100);
        uint256 buyId = _buy(SELL_PRICE, 30);
        orders.matchOrders(buyId, sellId);

        // Cancel the sell remainder (70 units) -> returned to seller.
        vm.prank(seller);
        orders.cancel(sellId);
        assertEq(asset.balanceOf(seller, ASSET_ID), 900 + 70);
    }

    function test_MatchOrders_RevertsIncompatibleSides() public {
        uint256 sellId = _sell(SELL_PRICE, 100);
        uint256 sellId2 = _sell(SELL_PRICE, 100);
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.IncompatibleOrders.selector, sellId, sellId2));
        orders.matchOrders(sellId, sellId2);
    }

    function test_MatchOrders_RevertsBidBelowAsk() public {
        uint256 sellId = _sell(SELL_PRICE, 100);
        uint256 buyId = _buy(SELL_PRICE - 1, 10);
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.IncompatibleOrders.selector, buyId, sellId));
        orders.matchOrders(buyId, sellId);
    }

    function test_MatchOrders_RevertsDifferentAsset() public {
        MockERC1155 other = new MockERC1155();
        other.mint(seller, ASSET_ID, 100);
        vm.prank(seller);
        other.setApprovalForAll(address(orders), true);

        uint256 sellId = _sell(SELL_PRICE, 100);
        vm.prank(buyer);
        uint256 buyId = orders.placeOrder(IOrderBook.Side.Buy, address(other), ASSET_ID, address(token), BUY_PRICE, 10);

        vm.expectRevert(abi.encodeWithSelector(IOrderBook.IncompatibleOrders.selector, buyId, sellId));
        orders.matchOrders(buyId, sellId);
    }

    function test_MatchOrders_RevertsUnknownOrder() public {
        uint256 sellId = _sell(SELL_PRICE, 100);
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.UnknownOrder.selector, 99));
        orders.matchOrders(99, sellId);
    }

    function test_MatchOrders_RevertsClosedWhenCancelled() public {
        uint256 sellId = _sell(SELL_PRICE, 100);
        uint256 buyId = _buy(BUY_PRICE, 40);
        vm.prank(buyer);
        orders.cancel(buyId);
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.OrderClosed.selector, buyId));
        orders.matchOrders(buyId, sellId);
    }

    // --- cancel ---

    function test_CancelBuy_RefundsPayment() public {
        uint256 buyId = _buy(BUY_PRICE, 40);
        vm.expectEmit(true, false, false, false);
        emit OrderCancelled(buyId);
        vm.prank(buyer);
        orders.cancel(buyId);
        assertEq(token.balanceOf(buyer), 100_000e6);
        assertEq(token.balanceOf(address(orders)), 0);
    }

    function test_CancelSell_RefundsAsset() public {
        uint256 sellId = _sell(SELL_PRICE, 100);
        vm.prank(seller);
        orders.cancel(sellId);
        assertEq(asset.balanceOf(seller, ASSET_ID), 1000);
    }

    function test_Cancel_RevertsNotMaker() public {
        uint256 sellId = _sell(SELL_PRICE, 100);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.NotMaker.selector, sellId));
        orders.cancel(sellId);
    }

    function test_Cancel_RevertsClosedTwice() public {
        uint256 sellId = _sell(SELL_PRICE, 100);
        vm.startPrank(seller);
        orders.cancel(sellId);
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.OrderClosed.selector, sellId));
        orders.cancel(sellId);
        vm.stopPrank();
    }

    // --- reentrancy (money-movement safety) ---

    function test_MatchOrders_ReentrancyBlocked() public {
        ReenterERC20 evil = new ReenterERC20();
        evil.mint(buyer, 100_000e6);
        vm.prank(buyer);
        evil.approve(address(orders), type(uint256).max);

        vm.prank(seller);
        uint256 sellId =
            orders.placeOrder(IOrderBook.Side.Sell, address(asset), ASSET_ID, address(evil), SELL_PRICE, 100);
        vm.prank(buyer);
        uint256 buyId = orders.placeOrder(IOrderBook.Side.Buy, address(asset), ASSET_ID, address(evil), BUY_PRICE, 40);

        // When the seller is paid, the token re-enters matchOrders — nonReentrant must block it.
        evil.arm(address(orders), abi.encodeWithSelector(orders.matchOrders.selector, buyId, sellId));

        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        orders.matchOrders(buyId, sellId);
    }
}
