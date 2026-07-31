// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";

/// @title PriceOracle
/// @notice Commodity spot-price feed keyed by symbol. Trusted keepers push integer prices (scaled by a
///         per-feed number of decimals) with a heartbeat staleness window; consumers read the latest price
///         and are protected by a freshness guard unless they explicitly opt out.
/// @dev Feeds are registered by keepers or pool managers, prices are pushed by keepers only. The
///      {latestPrice} read reverts {StalePrice} once `block.timestamp` exceeds `updatedAt + heartbeat`
///      (or before any price has ever been pushed), so downstream vaults/finance cannot value collateral
///      off a dead feed. {latestPriceUnsafe} bypasses the guard for callers that accept the risk.
contract PriceOracle is ProofChainAccess, IPriceOracle {
    /// @dev symbol => feed record.
    mapping(bytes32 => Feed) private _feeds;

    /// @dev symbol => registered flag (distinguishes "never registered" from "deactivated").
    mapping(bytes32 => bool) private _registered;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IPriceOracle
    function registerFeed(bytes32 symbol, uint8 decimals, uint32 heartbeat) external override {
        _requireFeedManager();
        _requireNotGloballyPaused();
        if (heartbeat == 0) revert ZeroHeartbeat();
        if (_registered[symbol]) revert FeedExists(symbol);

        _registered[symbol] = true;
        _feeds[symbol] = Feed({
            symbol: symbol,
            decimals: decimals,
            price: 0,
            updatedAt: 0,
            heartbeat: heartbeat,
            active: true
        });

        emit FeedRegistered(symbol, decimals, heartbeat);
    }

    /// @inheritdoc IPriceOracle
    function pushPrice(bytes32 symbol, uint256 price) external override onlyRole(Roles.KEEPER_ROLE) {
        _requireNotGloballyPaused();
        if (price == 0) revert ZeroPrice();
        Feed storage feed = _feeds[symbol];
        if (!_registered[symbol]) revert UnknownFeed(symbol);
        if (!feed.active) revert FeedInactive(symbol);

        feed.price = price;
        feed.updatedAt = uint64(block.timestamp);
        emit PriceUpdated(symbol, price, feed.updatedAt);
    }

    /// @inheritdoc IPriceOracle
    function deactivateFeed(bytes32 symbol) external override {
        _requireFeedManager();
        if (!_registered[symbol]) revert UnknownFeed(symbol);
        Feed storage feed = _feeds[symbol];
        if (!feed.active) revert FeedInactive(symbol);

        feed.active = false;
        emit FeedDeactivated(symbol);
    }

    /// @inheritdoc IPriceOracle
    function latestPrice(bytes32 symbol) external view override returns (uint256 price, uint64 updatedAt) {
        Feed storage feed = _feeds[symbol];
        if (!_registered[symbol]) revert UnknownFeed(symbol);
        if (!feed.active) revert FeedInactive(symbol);
        // A feed that has never been priced, or whose last update is older than its heartbeat, is stale.
        if (feed.updatedAt == 0 || block.timestamp > uint256(feed.updatedAt) + feed.heartbeat) {
            revert StalePrice(symbol, feed.updatedAt, feed.heartbeat);
        }
        return (feed.price, feed.updatedAt);
    }

    /// @inheritdoc IPriceOracle
    function latestPriceUnsafe(bytes32 symbol) external view override returns (uint256 price, uint64 updatedAt) {
        if (!_registered[symbol]) revert UnknownFeed(symbol);
        Feed storage feed = _feeds[symbol];
        return (feed.price, feed.updatedAt);
    }

    /// @inheritdoc IPriceOracle
    function feedOf(bytes32 symbol) external view override returns (Feed memory) {
        return _feeds[symbol];
    }

    /// @dev Feed lifecycle management (register/deactivate) is open to keepers and pool managers.
    function _requireFeedManager() private view {
        if (!hasRole(Roles.KEEPER_ROLE, msg.sender) && !hasRole(Roles.POOL_MANAGER_ROLE, msg.sender)) {
            revert IAccessControl.AccessControlUnauthorizedAccount(msg.sender, Roles.KEEPER_ROLE);
        }
    }
}
