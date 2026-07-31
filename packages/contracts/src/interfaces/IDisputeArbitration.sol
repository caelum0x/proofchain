// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IDisputeArbitration
/// @notice Staked arbiters vote on Disputed deals; the majority triggers refund-buyer or
///         arbiter-release-supplier on the SettlementEscrow.
/// @dev deps (AddressBook): SettlementEscrow, ArbiterStaking, SlashingController.
interface IDisputeArbitration {
    enum DisputeState {
        None,
        Open,
        Resolved
    }

    struct Dispute {
        bytes32 batchId;
        uint64 openedAt;
        uint256 votesRefund;
        uint256 votesRelease;
        DisputeState state;
        bool refundedBuyer;
    }

    event DisputeOpened(bytes32 indexed batchId, address indexed opener);
    event Voted(bytes32 indexed batchId, address indexed arbiter, bool refundBuyer);
    event Resolved(bytes32 indexed batchId, bool refundedBuyer);

    error DisputeExists(bytes32 batchId);
    error UnknownDispute(bytes32 batchId);
    error NotArbiter(address caller);
    error AlreadyVoted(bytes32 batchId, address arbiter);
    error DisputeNotOpen(bytes32 batchId);
    error VotingOngoing(bytes32 batchId);

    /// @notice Open a dispute over a Disputed escrow deal.
    function openDispute(bytes32 batchId) external;

    /// @notice Cast an arbiter vote: refund the buyer, or release to the supplier/payee.
    function vote(bytes32 batchId, bool refundBuyer) external;

    /// @notice Tally votes and execute the escrow outcome.
    function resolve(bytes32 batchId) external;

    function disputeOf(bytes32 batchId) external view returns (Dispute memory);
}
