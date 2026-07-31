// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IStorageReceipt
/// @notice Electronic (negotiable) warehouse receipt for commodities in storage. A warehouse operator issues
///         a receipt to a holder for a graded quantity of a commodity; the holder can transfer title, pledge
///         it as collateral (lien), and the operator settles it on physical withdrawal.
/// @dev deps (AddressBook): CommodityVault, GradingRegistry, HarvestRegistry, BondedWarehouse.
interface IStorageReceipt {
    enum ReceiptState {
        None,
        Issued,
        Pledged,
        Redeemed,
        Cancelled
    }

    struct Receipt {
        bytes32 receiptId;
        bytes32 warehouseId;
        address holder;
        bytes32 commodityCode;
        bytes32 grade;
        uint256 quantityKg;
        uint64 issuedAt;
        uint64 expiresAt;
        address lienHolder;
        ReceiptState state;
    }

    event ReceiptIssued(
        bytes32 indexed receiptId,
        bytes32 indexed warehouseId,
        address indexed holder,
        bytes32 commodityCode,
        uint256 quantityKg
    );
    event ReceiptTransferred(bytes32 indexed receiptId, address indexed from, address indexed to);
    event LienPlaced(bytes32 indexed receiptId, address indexed lienHolder);
    event LienReleased(bytes32 indexed receiptId, address indexed lienHolder);
    event ReceiptRedeemed(bytes32 indexed receiptId, address indexed holder);
    event ReceiptCancelled(bytes32 indexed receiptId, bytes32 reason);

    error ReceiptExists(bytes32 receiptId);
    error UnknownReceipt(bytes32 receiptId);
    error InvalidState(bytes32 receiptId, ReceiptState expected, ReceiptState actual);
    error NotHolder(bytes32 receiptId);
    error NotLienHolder(bytes32 receiptId);
    error Encumbered(bytes32 receiptId);
    error ZeroQuantity();

    /// @notice Issue a storage receipt for warehoused commodity. WAREHOUSE operator (REGISTRAR_ROLE) only.
    function issue(
        bytes32 receiptId,
        bytes32 warehouseId,
        address holder,
        bytes32 commodityCode,
        bytes32 grade,
        uint256 quantityKg,
        uint64 expiresAt
    ) external;

    /// @notice Transfer title of an unencumbered receipt to a new holder.
    function transfer(bytes32 receiptId, address to) external;

    /// @notice Pledge the receipt as collateral, placing a lien for a lender.
    function pledge(bytes32 receiptId, address lienHolder) external;

    /// @notice Release the lien on a pledged receipt. Lien holder only.
    function releaseLien(bytes32 receiptId) external;

    /// @notice Redeem the receipt on physical withdrawal, retiring it. Warehouse operator only.
    function redeem(bytes32 receiptId) external;

    /// @notice Cancel a receipt (issuance error/loss). Warehouse operator only.
    function cancel(bytes32 receiptId, bytes32 reason) external;

    function receiptOf(bytes32 receiptId) external view returns (Receipt memory);
}
