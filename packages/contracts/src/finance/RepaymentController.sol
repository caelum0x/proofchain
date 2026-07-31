// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IRepaymentController } from "../interfaces/IRepaymentController.sol";
import { ISettlementEscrow } from "../interfaces/ISettlementEscrow.sol";
import { IInvoiceFinancing } from "../interfaces/IInvoiceFinancing.sol";

/// @dev The pool hook the controller drives to close out a pooled allocation post-claim.
interface IPoolReconcile {
    function reconcile(bytes32 batchId) external;
}

/// @dev Preview surface of {InvoiceFinancing} used to report the repayment split.
interface IFinancingQuote {
    function quoteClaim(bytes32 batchId) external view returns (uint256 lenderTake, uint256 remainder);
}

/// @title RepaymentController
/// @notice One-call automation that finalises a financed receivable once the escrow releases: it
///         triggers the {InvoiceFinancing} claim (routing principal + yield to the lender and the
///         remainder to the supplier) and, when the lender is the {FinancingPool}, reconciles the
///         pool so the repaid capital and yield return to the vault.
/// @dev Permissionless and idempotent-safe: it only acts on a released, funded-but-unclaimed
///      financing, reverting {AlreadyProcessed} if the claim already happened. All peers resolved
///      via the {AddressBook}; no funds are custodied here — money moves inside the peers it calls.
contract RepaymentController is ProofChainAccess, ReentrancyGuard, IRepaymentController {
    /// @notice The financing was already claimed/finalised.
    error AlreadyProcessed(bytes32 batchId);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IRepaymentController
    function onSettle(bytes32 batchId) external nonReentrant {
        ISettlementEscrow escrow = ISettlementEscrow(_addr(Keys.SETTLEMENT_ESCROW));
        if (escrow.getDeal(batchId).state != ISettlementEscrow.DealState.Released) {
            revert NotSettled(batchId);
        }

        address financingAddr = _addr(Keys.INVOICE_FINANCING);
        IInvoiceFinancing financing = IInvoiceFinancing(financingAddr);
        IInvoiceFinancing.Listing memory listing = financing.listingOf(batchId);

        if (listing.state == IInvoiceFinancing.ListingState.None) revert NoFinancing(batchId);
        if (listing.state != IInvoiceFinancing.ListingState.Funded) revert AlreadyProcessed(batchId);

        // Snapshot the split for the event before the claim mutates state.
        (uint256 principalPlusFee, uint256 remainder) = IFinancingQuote(financingAddr).quoteClaim(batchId);

        // Route lender principal + yield and supplier remainder.
        financing.claim(batchId);

        // If the lender was the pool, return the repaid capital + yield to the vault.
        address pool = _addrOrZero(Keys.FINANCING_POOL);
        if (pool != address(0) && listing.lender == pool) {
            IPoolReconcile(pool).reconcile(batchId);
        }

        emit Repaid(batchId, listing.lender, principalPlusFee, remainder);
    }
}
