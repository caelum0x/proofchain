// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IStorageReceipt } from "../interfaces/IStorageReceipt.sol";

/// @title StorageReceipt
/// @notice Electronic negotiable warehouse receipt for commodities in storage. A warehouse operator
///         (REGISTRAR_ROLE) issues a receipt to a holder for a graded quantity; the holder may transfer
///         title or pledge it as collateral (placing a lien for a lender / the {CommodityVault}), and the
///         operator settles it on physical withdrawal.
/// @dev State machine: None → Issued ⇄ Pledged, and Issued → {Redeemed | Cancelled}. A pledged (encumbered)
///      receipt cannot be transferred, redeemed or cancelled until its lien is released by the lien holder.
///      The lien primitive is what the {CommodityVault} uses to take custody of backing inventory.
contract StorageReceipt is ProofChainAccess, IStorageReceipt {
    /// @dev receiptId => receipt record.
    mapping(bytes32 => Receipt) private _receipts;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IStorageReceipt
    function issue(
        bytes32 receiptId,
        bytes32 warehouseId,
        address holder,
        bytes32 commodityCode,
        bytes32 grade,
        uint256 quantityKg,
        uint64 expiresAt
    ) external override onlyRole(Roles.REGISTRAR_ROLE) {
        _requireNotGloballyPaused();
        if (holder == address(0)) revert ZeroAddress();
        if (quantityKg == 0) revert ZeroQuantity();
        if (_receipts[receiptId].state != ReceiptState.None) revert ReceiptExists(receiptId);

        _receipts[receiptId] = Receipt({
            receiptId: receiptId,
            warehouseId: warehouseId,
            holder: holder,
            commodityCode: commodityCode,
            grade: grade,
            quantityKg: quantityKg,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            lienHolder: address(0),
            state: ReceiptState.Issued
        });

        emit ReceiptIssued(receiptId, warehouseId, holder, commodityCode, quantityKg);
    }

    /// @inheritdoc IStorageReceipt
    function transfer(bytes32 receiptId, address to) external override {
        _requireNotGloballyPaused();
        if (to == address(0)) revert ZeroAddress();

        Receipt storage r = _requireHolder(receiptId);
        if (r.state != ReceiptState.Issued) revert Encumbered(receiptId);

        address from = r.holder;
        r.holder = to;
        emit ReceiptTransferred(receiptId, from, to);
    }

    /// @inheritdoc IStorageReceipt
    function pledge(bytes32 receiptId, address lienHolder) external override {
        _requireNotGloballyPaused();
        if (lienHolder == address(0)) revert ZeroAddress();

        Receipt storage r = _requireHolder(receiptId);
        if (r.state != ReceiptState.Issued) revert InvalidState(receiptId, ReceiptState.Issued, r.state);

        r.state = ReceiptState.Pledged;
        r.lienHolder = lienHolder;
        emit LienPlaced(receiptId, lienHolder);
    }

    /// @inheritdoc IStorageReceipt
    function releaseLien(bytes32 receiptId) external override {
        _requireNotGloballyPaused();
        Receipt storage r = _requireExists(receiptId);
        if (r.state != ReceiptState.Pledged) revert InvalidState(receiptId, ReceiptState.Pledged, r.state);
        if (msg.sender != r.lienHolder) revert NotLienHolder(receiptId);

        address lienHolder = r.lienHolder;
        r.lienHolder = address(0);
        r.state = ReceiptState.Issued;
        emit LienReleased(receiptId, lienHolder);
    }

    /// @inheritdoc IStorageReceipt
    function redeem(bytes32 receiptId) external override onlyRole(Roles.REGISTRAR_ROLE) {
        _requireNotGloballyPaused();
        Receipt storage r = _requireExists(receiptId);
        if (r.state == ReceiptState.Pledged) revert Encumbered(receiptId);
        if (r.state != ReceiptState.Issued) revert InvalidState(receiptId, ReceiptState.Issued, r.state);

        r.state = ReceiptState.Redeemed;
        emit ReceiptRedeemed(receiptId, r.holder);
    }

    /// @inheritdoc IStorageReceipt
    function cancel(bytes32 receiptId, bytes32 reason) external override onlyRole(Roles.REGISTRAR_ROLE) {
        _requireNotGloballyPaused();
        Receipt storage r = _requireExists(receiptId);
        if (r.state == ReceiptState.Pledged) revert Encumbered(receiptId);
        if (r.state != ReceiptState.Issued) revert InvalidState(receiptId, ReceiptState.Issued, r.state);

        r.state = ReceiptState.Cancelled;
        emit ReceiptCancelled(receiptId, reason);
    }

    /// @inheritdoc IStorageReceipt
    function receiptOf(bytes32 receiptId) external view override returns (Receipt memory) {
        return _receipts[receiptId];
    }

    /// @dev Load a receipt, reverting {UnknownReceipt} if it was never issued.
    function _requireExists(bytes32 receiptId) private view returns (Receipt storage r) {
        r = _receipts[receiptId];
        if (r.state == ReceiptState.None) revert UnknownReceipt(receiptId);
    }

    /// @dev Load a receipt and require the caller to be its current holder.
    function _requireHolder(bytes32 receiptId) private view returns (Receipt storage r) {
        r = _requireExists(receiptId);
        if (msg.sender != r.holder) revert NotHolder(receiptId);
    }
}
