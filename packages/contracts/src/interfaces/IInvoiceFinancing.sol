// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IInvoiceFinancing
/// @notice Supplier lists an attested receivable at a discount; a lender funds it and becomes the
///         escrow payee via `SettlementEscrow.setPayee`. On release the lender is repaid principal
///         and the remainder flows to the supplier.
/// @dev deps (AddressBook): SettlementEscrow, AttestationRegistry, InvoiceNFT, ReceivableRegistry.
interface IInvoiceFinancing {
    enum ListingState {
        None,
        Listed,
        Funded,
        Claimed,
        Cancelled
    }

    struct Listing {
        bytes32 batchId;
        address supplier;
        address lender;
        address token;
        uint256 askAmount;
        ListingState state;
    }

    event Listed(bytes32 indexed batchId, address indexed supplier, address token, uint256 askAmount);
    event Funded(bytes32 indexed batchId, address indexed lender, uint256 amount);
    event Claimed(bytes32 indexed batchId, address indexed lender, uint256 principal, uint256 remainderToSupplier);
    event Cancelled(bytes32 indexed batchId);

    error NotAttested(bytes32 batchId);
    error ListingExists(bytes32 batchId);
    error UnknownListing(bytes32 batchId);
    error NotSupplier(bytes32 batchId);
    error AlreadyFunded(bytes32 batchId);
    error NotFunded(bytes32 batchId);
    error ZeroAmount();

    /// @notice Supplier lists an attested receivable for financing at `askAmount`.
    function list(bytes32 batchId, uint256 askAmount) external;

    /// @notice Lender funds the listing, advancing `askAmount` and becoming escrow payee.
    function fund(bytes32 batchId) external;

    /// @notice After settlement release, distribute principal to lender and remainder to supplier.
    function claim(bytes32 batchId) external;

    /// @notice Supplier cancels an un-funded listing.
    function cancel(bytes32 batchId) external;

    function listingOf(bytes32 batchId) external view returns (Listing memory);
}
