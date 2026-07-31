// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal escrow stub exposing `getDeal` with a settable deal state.
/// @dev The Deal struct/enum layout mirrors `ISettlementEscrow` so `getDeal(bytes32)` is
///      ABI-compatible with the interface the ClaimsProcessor calls through.
contract MockEscrow {
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

    mapping(bytes32 => Deal) private _deals;

    function setDeal(bytes32 batchId, DealState state) external {
        _deals[batchId] = Deal({
            batchId: batchId,
            buyer: address(0),
            supplier: address(0),
            token: address(0),
            amount: 0,
            state: state
        });
    }

    function getDeal(bytes32 batchId) external view returns (Deal memory) {
        return _deals[batchId];
    }
}
