// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ISettlementEscrow } from "../../../src/interfaces/ISettlementEscrow.sol";

/// @notice Minimal {ISettlementEscrow} used to drive {DisputeArbitration} tests. It really holds
///         and moves ERC20 funds so refund/arbiter-release outcomes can be asserted on-chain, but
///         omits the attestation/provenance logic of the production escrow.
contract MockSettlementEscrow is ISettlementEscrow {
    using SafeERC20 for IERC20;

    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");
    uint16 public passThreshold = 7000;

    mapping(bytes32 => Deal) private _deals;
    mapping(bytes32 => address) public payeeOverride;

    /// @notice Test helper: create a Disputed deal and escrow `amount` pulled from the caller.
    function seedDisputed(bytes32 batchId, address buyer, address supplier, address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _deals[batchId] =
            Deal({ batchId: batchId, buyer: buyer, supplier: supplier, token: token, amount: amount, state: DealState.Disputed });
    }

    /// @notice Test helper: set an arbitrary deal state.
    function setState(bytes32 batchId, DealState state) external {
        _deals[batchId].state = state;
    }

    function fund(bytes32, address, address, uint256) external pure {
        revert("not implemented");
    }

    function settle(bytes32) external pure {
        revert("not implemented");
    }

    function setPassThreshold(uint16 newThreshold) external {
        emit PassThresholdUpdated(passThreshold, newThreshold);
        passThreshold = newThreshold;
    }

    function setPayee(bytes32 batchId, address payee) external {
        payeeOverride[batchId] = payee;
        emit PayeeSet(batchId, payee);
    }

    function refund(bytes32 batchId) external {
        Deal storage deal = _deals[batchId];
        if (deal.state != DealState.Disputed) revert NotDisputed(batchId);
        deal.state = DealState.Refunded;
        IERC20(deal.token).safeTransfer(deal.buyer, deal.amount);
        emit Refunded(batchId, deal.buyer, deal.amount);
    }

    function arbiterRelease(bytes32 batchId) external {
        Deal storage deal = _deals[batchId];
        if (deal.state != DealState.Disputed) revert NotDisputed(batchId);
        deal.state = DealState.Released;
        address payee = payeeOverride[batchId];
        if (payee == address(0)) payee = deal.supplier;
        IERC20(deal.token).safeTransfer(payee, deal.amount);
        emit ArbiterReleased(batchId, payee, deal.amount);
    }

    function getDeal(bytes32 batchId) external view returns (Deal memory) {
        return _deals[batchId];
    }
}
