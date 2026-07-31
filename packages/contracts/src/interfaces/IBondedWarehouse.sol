// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IBondedWarehouse
/// @notice Customs-bonded warehouse where imported goods are stored with duty suspended until they are
///         cleared for home use (duty paid) or re-exported. Operators register facilities and record
///         deposits; goods track their bonded status and accrued storage until release.
/// @dev deps (AddressBook): CustomsDeclaration, DutyAndTariffCalculator, WarehouseReceipt.
interface IBondedWarehouse {
    enum LotState {
        None,
        Bonded,
        DutyPaid,
        ReExported,
        Released
    }

    struct Warehouse {
        bytes32 warehouseId;
        address operator;
        bytes32 customsBondId;
        bytes32 location;
        bool active;
    }

    struct BondedLot {
        bytes32 lotId;
        bytes32 warehouseId;
        bytes32 batchId;
        address owner;
        uint256 quantity;
        uint64 depositedAt;
        LotState state;
    }

    event WarehouseRegistered(bytes32 indexed warehouseId, address indexed operator, bytes32 customsBondId, bytes32 location);
    event WarehouseDeactivated(bytes32 indexed warehouseId);
    event Deposited(bytes32 indexed lotId, bytes32 indexed warehouseId, bytes32 indexed batchId, address owner, uint256 quantity);
    event DutyPaid(bytes32 indexed lotId);
    event ReExported(bytes32 indexed lotId);
    event Released(bytes32 indexed lotId);

    error WarehouseExists(bytes32 warehouseId);
    error UnknownWarehouse(bytes32 warehouseId);
    error WarehouseInactive(bytes32 warehouseId);
    error NotOperator(bytes32 warehouseId);
    error LotExists(bytes32 lotId);
    error UnknownLot(bytes32 lotId);
    error InvalidState(bytes32 lotId, LotState expected, LotState actual);
    error ZeroQuantity();

    /// @notice Register a bonded warehouse facility. CUSTOMS_ROLE only.
    function registerWarehouse(bytes32 warehouseId, address operator, bytes32 customsBondId, bytes32 location) external;

    /// @notice Deactivate a warehouse.
    function deactivateWarehouse(bytes32 warehouseId) external;

    /// @notice Deposit a batch into bond (duty suspended). Operator only.
    function deposit(bytes32 lotId, bytes32 warehouseId, bytes32 batchId, address owner, uint256 quantity) external;

    /// @notice Clear a bonded lot for home use after duty payment. CUSTOMS_ROLE only.
    function clearForHomeUse(bytes32 lotId) external;

    /// @notice Record re-export of a bonded lot (duty never becomes due). CUSTOMS_ROLE only.
    function reExport(bytes32 lotId) external;

    /// @notice Release goods from the warehouse after duty-paid/re-export.
    function release(bytes32 lotId) external;

    function warehouseOf(bytes32 warehouseId) external view returns (Warehouse memory);
    function lotOf(bytes32 lotId) external view returns (BondedLot memory);
}
