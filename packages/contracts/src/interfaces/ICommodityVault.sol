// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICommodityVault
/// @notice Custody vault that bridges physical warehoused commodity and its ERC20 CommodityToken. A verified
///         storage receipt is deposited to mint backing tokens to a holder; tokens are burned to redeem the
///         receipt for physical withdrawal. The vault enforces 1:1 backing between receipts and token supply.
/// @dev deps (AddressBook): CommodityToken, StorageReceipt, GradingRegistry, PriceOracle. SafeERC20 + nonReentrant.
interface ICommodityVault {
    enum PositionState {
        None,
        Collateralized,
        Redeemed
    }

    struct Position {
        bytes32 receiptId;
        address holder;
        bytes32 commodityCode;
        uint256 tokenAmount;
        uint64 depositedAt;
        PositionState state;
    }

    event Deposited(bytes32 indexed receiptId, address indexed holder, bytes32 indexed commodityCode, uint256 tokenAmount);
    event Redeemed(bytes32 indexed receiptId, address indexed holder, uint256 tokenAmount);

    error PositionExists(bytes32 receiptId);
    error UnknownPosition(bytes32 receiptId);
    error InvalidState(bytes32 receiptId, PositionState expected, PositionState actual);
    error NotHolder(bytes32 receiptId);
    error ReceiptNotEligible(bytes32 receiptId);
    error ZeroAmount();

    /// @notice Deposit a verified storage receipt and mint backing CommodityTokens to the holder. nonReentrant.
    function deposit(bytes32 receiptId) external returns (uint256 tokenAmount);

    /// @notice Burn CommodityTokens to redeem the receipt for physical withdrawal. nonReentrant.
    function redeem(bytes32 receiptId) external;

    /// @notice Total token amount currently backed by receipts in the vault.
    function totalBacked() external view returns (uint256);

    function positionOf(bytes32 receiptId) external view returns (Position memory);
}
