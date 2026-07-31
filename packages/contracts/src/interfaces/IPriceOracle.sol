// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IPriceOracle
/// @notice Commodity spot-price feed keyed by symbol. Keepers push signed prices with a staleness window;
///         consumers read the latest price and must respect the freshness guard. Prices are integer values
///         scaled by a fixed number of decimals per feed.
/// @dev deps (AddressBook): OracleAggregator (optional upstream), CommodityToken, CommodityVault.
interface IPriceOracle {
    struct Feed {
        bytes32 symbol;
        uint8 decimals;
        uint256 price;
        uint64 updatedAt;
        uint32 heartbeat;
        bool active;
    }

    event FeedRegistered(bytes32 indexed symbol, uint8 decimals, uint32 heartbeat);
    event PriceUpdated(bytes32 indexed symbol, uint256 price, uint64 updatedAt);
    event FeedDeactivated(bytes32 indexed symbol);

    error FeedExists(bytes32 symbol);
    error UnknownFeed(bytes32 symbol);
    error FeedInactive(bytes32 symbol);
    error StalePrice(bytes32 symbol, uint64 updatedAt, uint32 heartbeat);
    error ZeroPrice();
    error ZeroHeartbeat();

    /// @notice Register a price feed for a symbol. KEEPER_ROLE / POOL_MANAGER_ROLE.
    function registerFeed(bytes32 symbol, uint8 decimals, uint32 heartbeat) external;

    /// @notice Push a new price for a symbol. KEEPER_ROLE only.
    function pushPrice(bytes32 symbol, uint256 price) external;

    /// @notice Deactivate a feed.
    function deactivateFeed(bytes32 symbol) external;

    /// @notice Latest price and its timestamp; reverts if the price is stale beyond the heartbeat.
    function latestPrice(bytes32 symbol) external view returns (uint256 price, uint64 updatedAt);

    /// @notice Latest price ignoring the staleness guard (caller assumes responsibility).
    function latestPriceUnsafe(bytes32 symbol) external view returns (uint256 price, uint64 updatedAt);

    function feedOf(bytes32 symbol) external view returns (Feed memory);
}
