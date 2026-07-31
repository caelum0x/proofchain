// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IPurchaseOrderFinancing
/// @notice Pre-shipment finance: a supplier with a confirmed buyer purchase order borrows working
///         capital against it to fund production. The financier advances up to a limit; on buyer
///         payment at delivery the advance plus fee is repaid and any surplus returns to the supplier.
/// @dev deps (AddressBook): AttestationRegistry, SettlementEscrow, StablecoinRegistry, OrganizationRegistry.
interface IPurchaseOrderFinancing {
    enum POState {
        None,
        Registered,
        Financed,
        Delivered,
        Repaid,
        Defaulted,
        Cancelled
    }

    struct PO {
        bytes32 poId;
        bytes32 batchId;
        address supplier;
        address buyer;
        address financier;
        address token;
        uint256 poValue;
        uint256 advance;
        uint16 feeBps;
        uint64 dueDate;
        POState state;
    }

    event Registered(
        bytes32 indexed poId, bytes32 indexed batchId, address indexed supplier, address buyer, uint256 poValue
    );
    event Financed(bytes32 indexed poId, address indexed financier, uint256 advance, uint16 feeBps);
    event Delivered(bytes32 indexed poId, bytes32 batchId);
    event Repaid(bytes32 indexed poId, uint256 principal, uint256 fee, uint256 surplusToSupplier);
    event Defaulted(bytes32 indexed poId);
    event Cancelled(bytes32 indexed poId);

    error POExists(bytes32 poId);
    error UnknownPO(bytes32 poId);
    error InvalidState(bytes32 poId, POState expected, POState actual);
    error NotSupplier(bytes32 poId);
    error NotFinancier(bytes32 poId);
    error NotAttested(bytes32 batchId);
    error ZeroAmount();
    error AdvanceExceedsValue(uint256 advance, uint256 poValue);

    /// @notice Supplier registers a confirmed purchase order eligible for financing.
    function register(bytes32 poId, bytes32 batchId, address buyer, address token, uint256 poValue, uint64 dueDate)
        external;

    /// @notice Financier advances working capital against the PO.
    function finance(bytes32 poId, uint256 advance, uint16 feeBps) external;

    /// @notice Record delivery/attestation of the underlying batch.
    function markDelivered(bytes32 poId) external;

    /// @notice Repay the advance plus fee from buyer settlement; surplus flows to the supplier.
    function repay(bytes32 poId) external;

    /// @notice Mark a PO defaulted after the due date without repayment.
    function markDefault(bytes32 poId) external;

    /// @notice Supplier cancels an un-financed PO.
    function cancel(bytes32 poId) external;

    function poOf(bytes32 poId) external view returns (PO memory);
}
