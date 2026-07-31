// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISettlementEscrow
/// @notice External surface of the escrow that holds buyer funds and releases them on a passing
///         attestation. Includes the M2 extensions: payee override (invoice-financing assignment)
///         and arbiter release for disputed deals.
/// @dev Finance (InvoiceFinancing/RepaymentController) and governance (DisputeArbitration)
///      modules import THIS interface to drive settlement.
interface ISettlementEscrow {
    enum DealState {
        None,
        Funded,
        Released,
        Refunded,
        Disputed
    }

    struct Deal {
        bytes32 batchId;
        address buyer;
        address supplier;
        address token;
        uint256 amount;
        DealState state;
    }

    event Funded(bytes32 indexed batchId, address indexed buyer, address supplier, address token, uint256 amount);
    event Released(bytes32 indexed batchId, address indexed supplier, uint256 amount);
    event Disputed(bytes32 indexed batchId, uint16 score);
    event Refunded(bytes32 indexed batchId, address indexed buyer, uint256 amount);
    event PassThresholdUpdated(uint16 oldT, uint16 newT);
    /// @notice Emitted when a supplier assigns a batch's payout to another address (financing).
    event PayeeSet(bytes32 indexed batchId, address indexed payee);
    /// @notice Emitted when an arbiter releases a disputed deal to the payee.
    event ArbiterReleased(bytes32 indexed batchId, address indexed payee, uint256 amount);

    error DealExists(bytes32 batchId);
    error NotFunded(bytes32 batchId);
    error ZeroAmount();
    error AlreadySettled(bytes32 batchId);
    error NotAttested(bytes32 batchId);
    error UnknownBatch(bytes32 batchId);
    error SupplierMismatch(bytes32 batchId);
    error NotDisputed(bytes32 batchId);
    error ZeroAddress();
    error InvalidThreshold(uint16 threshold);
    error NotSupplier(bytes32 batchId);
    error NotFundedState(bytes32 batchId);

    function ARBITER_ROLE() external view returns (bytes32);
    function passThreshold() external view returns (uint16);

    // --- core lifecycle ---
    function fund(bytes32 batchId, address supplier, address token, uint256 amount) external;
    function settle(bytes32 batchId) external;
    function refund(bytes32 batchId) external;
    function setPassThreshold(uint16 newThreshold) external;

    // --- M2 extensions ---
    /// @notice Supplier reassigns the payout target for a Funded deal (invoice financing).
    function setPayee(bytes32 batchId, address payee) external;
    /// @notice The effective payout target for a batch (override if set, else supplier).
    function payeeOverride(bytes32 batchId) external view returns (address);
    /// @notice Arbiter releases a Disputed deal to the (possibly overridden) payee. ARBITER_ROLE.
    function arbiterRelease(bytes32 batchId) external;

    // --- views ---
    function getDeal(bytes32 batchId) external view returns (Deal memory);
}
