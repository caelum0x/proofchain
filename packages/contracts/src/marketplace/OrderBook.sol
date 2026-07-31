// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { IOrderBook } from "../interfaces/IOrderBook.sol";

/// @title OrderBook
/// @notice On-chain limit-order book for fungible tokenized assets (ERC1155 units — e.g. carbon
///         credits) priced in an ERC20 payment token. Sell orders escrow the asset units; buy orders
///         escrow the payment. Anyone may match a compatible pair: fills execute at the resting sell
///         (ask) price, so a buyer bidding above the ask is refunded the price improvement. Orders may
///         fill partially and are cancellable by their maker for any unfilled remainder.
/// @dev Fully custodial and permissionless-match. Both asset and payment legs are escrowed up front so
///      a match can never fail for lack of funds. All transfers use `SafeERC20` / ERC1155 safe
///      transfers; every state-changing external is `nonReentrant`. Custodies ERC1155 via
///      {ERC1155Holder}.
contract OrderBook is ProofChainAccess, ReentrancyGuard, ERC1155Holder, IOrderBook {
    using SafeERC20 for IERC20;

    /// @dev Monotonic id counter; first order is id 1 so 0 is an unambiguous "none".
    uint256 private _nextOrderId = 1;

    /// @dev orderId => Order record.
    mapping(uint256 => Order) private _orders;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IOrderBook
    /// @dev Sell orders pull `quantity` ERC1155 units into escrow; buy orders pull `price * quantity`
    ///      of the ERC20 payment token. Maker must have approved this contract for the relevant token.
    function placeOrder(
        Side side,
        address asset,
        uint256 assetId,
        address paymentToken,
        uint256 price,
        uint256 quantity
    ) external override nonReentrant returns (uint256 orderId) {
        _requireNotGloballyPaused();
        if (asset == address(0) || paymentToken == address(0)) revert ZeroAddress();
        if (price == 0) revert ZeroPrice();
        if (quantity == 0) revert ZeroQuantity();

        orderId = _nextOrderId++;
        _orders[orderId] = Order({
            orderId: orderId,
            side: side,
            asset: asset,
            assetId: assetId,
            paymentToken: paymentToken,
            price: price,
            quantity: quantity,
            filled: 0,
            maker: msg.sender,
            cancelled: false
        });

        // Escrow the maker's side of the trade.
        if (side == Side.Sell) {
            IERC1155(asset).safeTransferFrom(msg.sender, address(this), assetId, quantity, "");
        } else {
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), price * quantity);
        }

        emit OrderPlaced(orderId, side, msg.sender, asset, price, quantity);
    }

    /// @inheritdoc IOrderBook
    /// @dev Permissionless. Validates the pair is compatible (opposite sides, same asset/id/payment,
    ///      bid ≥ ask), fills `min(remaining)` at the ask price, and refunds the buyer any price
    ///      improvement. Callable repeatedly until one side is exhausted.
    function matchOrders(uint256 buyOrderId, uint256 sellOrderId) external override nonReentrant {
        Order storage buy = _get(buyOrderId);
        Order storage sell = _get(sellOrderId);

        if (buy.side != Side.Buy || sell.side != Side.Sell) revert IncompatibleOrders(buyOrderId, sellOrderId);
        if (buy.asset != sell.asset || buy.assetId != sell.assetId || buy.paymentToken != sell.paymentToken) {
            revert IncompatibleOrders(buyOrderId, sellOrderId);
        }
        if (buy.price < sell.price) revert IncompatibleOrders(buyOrderId, sellOrderId);

        _requireOpen(buy);
        _requireOpen(sell);

        uint256 buyRemaining = buy.quantity - buy.filled;
        uint256 sellRemaining = sell.quantity - sell.filled;
        uint256 fillQty = buyRemaining < sellRemaining ? buyRemaining : sellRemaining;
        if (fillQty == 0) revert OrderClosed(buyRemaining == 0 ? buyOrderId : sellOrderId);

        uint256 execPrice = sell.price; // fills at the resting ask.
        uint256 payment = fillQty * execPrice;
        uint256 buyerRefund = fillQty * (buy.price - execPrice); // price improvement back to buyer.

        // Effects before interactions (CEI + reentrancy safety).
        buy.filled += fillQty;
        sell.filled += fillQty;

        // Interactions: asset to the buyer, proceeds to the seller, improvement back to the buyer.
        IERC1155(sell.asset).safeTransferFrom(address(this), buy.maker, sell.assetId, fillQty, "");
        IERC20(sell.paymentToken).safeTransfer(sell.maker, payment);
        if (buyerRefund != 0) {
            IERC20(buy.paymentToken).safeTransfer(buy.maker, buyerRefund);
        }

        emit OrderMatched(buyOrderId, sellOrderId, fillQty, execPrice);
    }

    /// @inheritdoc IOrderBook
    /// @dev Cancels the maker's order and returns the unfilled escrow: remaining ERC1155 units for a
    ///      sell, or remaining payment (`remaining * price`) for a buy.
    function cancel(uint256 orderId) external override nonReentrant {
        Order storage order = _get(orderId);
        if (order.maker != msg.sender) revert NotMaker(orderId);
        _requireOpen(order);

        order.cancelled = true;
        uint256 remaining = order.quantity - order.filled;

        if (order.side == Side.Sell) {
            IERC1155(order.asset).safeTransferFrom(address(this), order.maker, order.assetId, remaining, "");
        } else {
            IERC20(order.paymentToken).safeTransfer(order.maker, remaining * order.price);
        }

        emit OrderCancelled(orderId);
    }

    /// @inheritdoc IOrderBook
    function orderOf(uint256 orderId) external view override returns (Order memory) {
        return _get(orderId);
    }

    /// @notice Total number of orders ever placed (ids run 1..totalOrders).
    function totalOrders() external view returns (uint256) {
        return _nextOrderId - 1;
    }

    /// @dev Load an order by id, reverting {UnknownOrder} if it was never created.
    function _get(uint256 orderId) private view returns (Order storage) {
        if (orderId == 0 || orderId >= _nextOrderId) revert UnknownOrder(orderId);
        return _orders[orderId];
    }

    /// @dev Revert {OrderClosed} if an order is cancelled or already fully filled.
    function _requireOpen(Order storage order) private view {
        if (order.cancelled || order.filled >= order.quantity) revert OrderClosed(order.orderId);
    }

    /// @dev Resolve the ERC165 ambiguity between AccessControl and ERC1155Holder.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl, ERC1155Holder)
        returns (bool)
    {
        return AccessControl.supportsInterface(interfaceId) || ERC1155Holder.supportsInterface(interfaceId);
    }
}
