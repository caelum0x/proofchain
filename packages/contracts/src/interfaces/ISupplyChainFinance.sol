// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISupplyChainFinance
/// @notice Reverse factoring / approved-payables finance. An anchor buyer approves supplier invoices
///         under a funded program; suppliers draw early payment from the funder at the program discount,
///         and the buyer repays the funder in full at each invoice due date.
/// @dev deps (AddressBook): AttestationRegistry, StablecoinRegistry, SettlementEscrow, OrganizationRegistry.
interface ISupplyChainFinance {
    enum InvoiceState {
        None,
        Approved,
        EarlyPaid,
        Settled,
        Overdue,
        Cancelled
    }

    struct Program {
        bytes32 programId;
        address anchorBuyer;
        address funder;
        address token;
        uint16 discountBps;
        uint256 fundingLimit;
        uint256 utilized;
        bool active;
    }

    struct ProgramInvoice {
        bytes32 invoiceId;
        bytes32 programId;
        bytes32 batchId;
        address supplier;
        uint256 amount;
        uint64 dueDate;
        InvoiceState state;
    }

    event ProgramCreated(
        bytes32 indexed programId, address indexed anchorBuyer, address indexed funder, address token, uint256 fundingLimit
    );
    event ProgramUpdated(bytes32 indexed programId, uint16 discountBps, uint256 fundingLimit, bool active);
    event InvoiceApproved(
        bytes32 indexed invoiceId, bytes32 indexed programId, address indexed supplier, uint256 amount, uint64 dueDate
    );
    event EarlyPaid(bytes32 indexed invoiceId, address indexed supplier, uint256 paidAmount, uint256 discount);
    event Settled(bytes32 indexed invoiceId, uint256 amount);
    event MarkedOverdue(bytes32 indexed invoiceId);

    error ProgramExists(bytes32 programId);
    error UnknownProgram(bytes32 programId);
    error InvoiceExists(bytes32 invoiceId);
    error UnknownInvoice(bytes32 invoiceId);
    error InvalidState(bytes32 invoiceId, InvoiceState expected, InvoiceState actual);
    error NotAnchorBuyer(bytes32 programId);
    error NotSupplier(bytes32 invoiceId);
    error ProgramInactive(bytes32 programId);
    error LimitExceeded(uint256 requested, uint256 available);
    error ZeroAmount();
    error NotAttested(bytes32 batchId);

    /// @notice Anchor buyer creates a funded reverse-factoring program.
    function createProgram(bytes32 programId, address funder, address token, uint16 discountBps, uint256 fundingLimit)
        external;

    /// @notice Update a program's discount, limit or active flag.
    function updateProgram(bytes32 programId, uint16 discountBps, uint256 fundingLimit, bool active) external;

    /// @notice Anchor buyer approves a supplier invoice for early-payment eligibility.
    function approveInvoice(bytes32 invoiceId, bytes32 programId, bytes32 batchId, address supplier, uint256 amount, uint64 dueDate)
        external;

    /// @notice Supplier draws early payment from the funder at the program discount.
    function drawEarlyPayment(bytes32 invoiceId) external;

    /// @notice Buyer settles the invoice in full with the funder at due date.
    function settle(bytes32 invoiceId) external;

    /// @notice Flag an unsettled, past-due invoice as overdue.
    function markOverdue(bytes32 invoiceId) external;

    function programOf(bytes32 programId) external view returns (Program memory);
    function invoiceOf(bytes32 invoiceId) external view returns (ProgramInvoice memory);
}
