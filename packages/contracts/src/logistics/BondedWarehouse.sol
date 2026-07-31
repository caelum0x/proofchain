// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IBondedWarehouse } from "../interfaces/IBondedWarehouse.sol";
import { IWarehouseReceipt } from "../interfaces/IWarehouseReceipt.sol";

/// @title BondedWarehouse
/// @notice Customs-bonded warehouse registry. Customs authorities register facilities backed by a
///         surety bond; operators deposit imported batches into bond with duty suspended. Each
///         bonded lot advances to duty-paid (cleared for home use) or re-exported, and is then
///         released from the facility. Optionally a tokenized {WarehouseReceipt} is issued on deposit.
/// @dev Deps resolved via the {AddressBook}. Customs-authority actions require `CUSTOMS_ROLE`;
///      deposits/releases are operator-gated. The {WarehouseReceipt} mint is OPTIONAL and
///      best-effort (requires this contract to hold MINTER_ROLE there) and never blocks a deposit.
contract BondedWarehouse is ProofChainAccess, IBondedWarehouse {
    mapping(bytes32 => Warehouse) private _warehouses;
    mapping(bytes32 => BondedLot) private _lots;
    /// @dev Warehouse receipt tokenId minted for a lot on deposit (0 when none).
    mapping(bytes32 => uint256) private _receiptOf;

    /// @notice Emitted when a tokenized warehouse receipt is issued for a bonded lot.
    event ReceiptIssued(bytes32 indexed lotId, uint256 indexed tokenId);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IBondedWarehouse
    function registerWarehouse(bytes32 warehouseId, address operator, bytes32 customsBondId, bytes32 location)
        external
        onlyRole(Roles.CUSTOMS_ROLE)
    {
        _requireNotGloballyPaused();
        if (operator == address(0)) revert ZeroAddress();
        if (_warehouses[warehouseId].operator != address(0)) revert WarehouseExists(warehouseId);

        _warehouses[warehouseId] = Warehouse({
            warehouseId: warehouseId,
            operator: operator,
            customsBondId: customsBondId,
            location: location,
            active: true
        });

        emit WarehouseRegistered(warehouseId, operator, customsBondId, location);
    }

    /// @inheritdoc IBondedWarehouse
    function deactivateWarehouse(bytes32 warehouseId) external {
        _requireNotGloballyPaused();
        Warehouse storage w = _warehouse(warehouseId);
        if (msg.sender != w.operator && !hasRole(Roles.CUSTOMS_ROLE, msg.sender)) {
            revert NotOperator(warehouseId);
        }
        if (!w.active) revert WarehouseInactive(warehouseId);

        w.active = false;
        emit WarehouseDeactivated(warehouseId);
    }

    /// @inheritdoc IBondedWarehouse
    function deposit(bytes32 lotId, bytes32 warehouseId, bytes32 batchId, address owner, uint256 quantity)
        external
    {
        _requireNotGloballyPaused();
        Warehouse storage w = _warehouse(warehouseId);
        if (msg.sender != w.operator) revert NotOperator(warehouseId);
        if (!w.active) revert WarehouseInactive(warehouseId);
        if (owner == address(0)) revert ZeroAddress();
        if (quantity == 0) revert ZeroQuantity();
        if (_lots[lotId].state != LotState.None) revert LotExists(lotId);

        _lots[lotId] = BondedLot({
            lotId: lotId,
            warehouseId: warehouseId,
            batchId: batchId,
            owner: owner,
            quantity: quantity,
            depositedAt: uint64(block.timestamp),
            state: LotState.Bonded
        });

        emit Deposited(lotId, warehouseId, batchId, owner, quantity);

        _tryIssueReceipt(lotId, batchId, owner, quantity, w.location);
    }

    /// @inheritdoc IBondedWarehouse
    function clearForHomeUse(bytes32 lotId) external onlyRole(Roles.CUSTOMS_ROLE) {
        _requireNotGloballyPaused();
        BondedLot storage lot = _lot(lotId);
        if (lot.state != LotState.Bonded) revert InvalidState(lotId, LotState.Bonded, lot.state);

        lot.state = LotState.DutyPaid;
        emit DutyPaid(lotId);
    }

    /// @inheritdoc IBondedWarehouse
    function reExport(bytes32 lotId) external onlyRole(Roles.CUSTOMS_ROLE) {
        _requireNotGloballyPaused();
        BondedLot storage lot = _lot(lotId);
        if (lot.state != LotState.Bonded) revert InvalidState(lotId, LotState.Bonded, lot.state);

        lot.state = LotState.ReExported;
        emit ReExported(lotId);
    }

    /// @inheritdoc IBondedWarehouse
    function release(bytes32 lotId) external {
        _requireNotGloballyPaused();
        BondedLot storage lot = _lot(lotId);
        Warehouse storage w = _warehouses[lot.warehouseId];
        if (msg.sender != w.operator && !hasRole(Roles.CUSTOMS_ROLE, msg.sender)) {
            revert NotOperator(lot.warehouseId);
        }
        if (lot.state != LotState.DutyPaid && lot.state != LotState.ReExported) {
            revert InvalidState(lotId, LotState.DutyPaid, lot.state);
        }

        lot.state = LotState.Released;
        emit Released(lotId);
    }

    /// @inheritdoc IBondedWarehouse
    function warehouseOf(bytes32 warehouseId) external view returns (Warehouse memory) {
        return _warehouses[warehouseId];
    }

    /// @inheritdoc IBondedWarehouse
    function lotOf(bytes32 lotId) external view returns (BondedLot memory) {
        return _lots[lotId];
    }

    /// @notice Warehouse receipt tokenId minted for a lot (0 when none).
    function receiptTokenOf(bytes32 lotId) external view returns (uint256) {
        return _receiptOf[lotId];
    }

    // --------------------------------------------------------------------- internal

    function _warehouse(bytes32 warehouseId) private view returns (Warehouse storage w) {
        w = _warehouses[warehouseId];
        if (w.operator == address(0)) revert UnknownWarehouse(warehouseId);
    }

    function _lot(bytes32 lotId) private view returns (BondedLot storage lot) {
        lot = _lots[lotId];
        if (lot.state == LotState.None) revert UnknownLot(lotId);
    }

    /// @dev Best-effort tokenized receipt issuance; requires MINTER_ROLE on the {WarehouseReceipt}.
    function _tryIssueReceipt(bytes32 lotId, bytes32 batchId, address owner, uint256 quantity, bytes32 location)
        private
    {
        address wr = _addrOrZero(Keys.WAREHOUSE_RECEIPT);
        if (wr == address(0)) return;
        try IWarehouseReceipt(wr).issue(batchId, owner, quantity, _toHexString(location)) returns (uint256 tokenId) {
            _receiptOf[lotId] = tokenId;
            emit ReceiptIssued(lotId, tokenId);
        } catch { }
    }

    /// @dev Render a bytes32 location code as an ASCII hex string for the receipt's `location` field.
    function _toHexString(bytes32 value) private pure returns (string memory) {
        bytes16 hexSymbols = "0123456789abcdef";
        bytes memory buffer = new bytes(66);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(value[i]);
            buffer[2 + i * 2] = hexSymbols[b >> 4];
            buffer[3 + i * 2] = hexSymbols[b & 0x0f];
        }
        return string(buffer);
    }
}
