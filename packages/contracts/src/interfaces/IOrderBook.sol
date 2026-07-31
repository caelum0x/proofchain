// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IOrderBook
/// @notice Limit orders for tokenized assets (ERC20/1155 fungible units).
interface IOrderBook {
    enum Side {
        Buy,
        Sell
    }

    struct Order {
        uint256 orderId;
        Side side;
        address asset;
        uint256 assetId;
        address paymentToken;
        uint256 price;
        uint256 quantity;
        uint256 filled;
        address maker;
        bool cancelled;
    }

    event OrderPlaced(
        uint256 indexed orderId, Side side, address indexed maker, address asset, uint256 price, uint256 quantity
    );
    event OrderMatched(uint256 indexed buyOrderId, uint256 indexed sellOrderId, uint256 quantity, uint256 price);
    event OrderCancelled(uint256 indexed orderId);

    error UnknownOrder(uint256 orderId);
    error NotMaker(uint256 orderId);
    error OrderClosed(uint256 orderId);
    error ZeroQuantity();
    error ZeroPrice();
    error IncompatibleOrders(uint256 buyOrderId, uint256 sellOrderId);

    /// @notice Place a limit order.
    function placeOrder(
        Side side,
        address asset,
        uint256 assetId,
        address paymentToken,
        uint256 price,
        uint256 quantity
    ) external returns (uint256 orderId);

    /// @notice Match a compatible buy/sell pair.
    function matchOrders(uint256 buyOrderId, uint256 sellOrderId) external;

    /// @notice Cancel an open order you made.
    function cancel(uint256 orderId) external;

    function orderOf(uint256 orderId) external view returns (Order memory);
}
