// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IRepaymentController
/// @notice On settlement release, routes lender principal + fee, then supplier remainder.
/// @dev deps (AddressBook): SettlementEscrow, InvoiceFinancing, FeeManager, YieldDistributor.
interface IRepaymentController {
    event Repaid(bytes32 indexed batchId, address indexed lender, uint256 principalPlusFee, uint256 remainder);

    error NotSettled(bytes32 batchId);
    error NoFinancing(bytes32 batchId);

    /// @notice Handle repayment routing for a batch that has just been released from escrow.
    function onSettle(bytes32 batchId) external;
}
