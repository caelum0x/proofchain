// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IInvoiceFinancing } from "../../../src/interfaces/IInvoiceFinancing.sol";

/// @notice Test double for {InvoiceFinancing}. Only {listingOf} matters to the
///         {FinancingMarketplace}; the mutating functions are provided to satisfy the interface and
///         let tests drive listing state directly via {setListing}.
contract MockInvoiceFinancing is IInvoiceFinancing {
    mapping(bytes32 => Listing) private _listings;

    /// @notice Test helper: set an arbitrary listing record for `batchId`.
    function setListing(bytes32 batchId, address supplier, address token, uint256 askAmount, ListingState state)
        external
    {
        _listings[batchId] = Listing({
            batchId: batchId,
            supplier: supplier,
            lender: address(0),
            token: token,
            askAmount: askAmount,
            state: state
        });
    }

    function listingOf(bytes32 batchId) external view override returns (Listing memory) {
        return _listings[batchId];
    }

    // --- interface stubs (unused by FinancingMarketplace) ---

    function list(bytes32 batchId, uint256 askAmount) external override {
        Listing storage l = _listings[batchId];
        l.batchId = batchId;
        l.supplier = msg.sender;
        l.askAmount = askAmount;
        l.state = ListingState.Listed;
    }

    function fund(bytes32 batchId) external override {
        _listings[batchId].lender = msg.sender;
        _listings[batchId].state = ListingState.Funded;
    }

    function claim(bytes32 batchId) external override {
        _listings[batchId].state = ListingState.Claimed;
    }

    function cancel(bytes32 batchId) external override {
        _listings[batchId].state = ListingState.Cancelled;
    }
}
