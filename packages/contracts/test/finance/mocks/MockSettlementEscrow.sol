// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ISettlementEscrow } from "../../../src/interfaces/ISettlementEscrow.sol";

/// @notice Minimal test double for the M2 SettlementEscrow, exposing exactly the surface the
///         finance module drives (getDeal / payeeOverride / setPayee) plus test helpers to seed a
///         deal and simulate a passing settlement that releases funds to the assigned payee.
/// @dev The real escrow custodies the buyer's funds; here tests mint the escrowed amount to this
///      contract and call {release} to emulate `settle()` paying out the (possibly overridden) payee.
contract MockSettlementEscrow {
    using SafeERC20 for IERC20;

    mapping(bytes32 => ISettlementEscrow.Deal) private _deals;
    mapping(bytes32 => address) private _payee;

    error NotSupplier(bytes32 batchId);

    // --- test seeding helpers ---

    function setDeal(
        bytes32 batchId,
        address buyer,
        address supplier,
        address token,
        uint256 amount,
        ISettlementEscrow.DealState state
    ) external {
        _deals[batchId] = ISettlementEscrow.Deal({
            batchId: batchId,
            buyer: buyer,
            supplier: supplier,
            token: token,
            amount: amount,
            state: state
        });
    }

    function setState(bytes32 batchId, ISettlementEscrow.DealState state) external {
        _deals[batchId].state = state;
    }

    /// @notice Emulate a passing settlement: pay the effective payee and mark the deal Released.
    function release(bytes32 batchId) external {
        ISettlementEscrow.Deal storage deal = _deals[batchId];
        deal.state = ISettlementEscrow.DealState.Released;
        address to = _payee[batchId] == address(0) ? deal.supplier : _payee[batchId];
        IERC20(deal.token).safeTransfer(to, deal.amount);
    }

    // --- ISettlementEscrow surface used by finance ---

    function getDeal(bytes32 batchId) external view returns (ISettlementEscrow.Deal memory) {
        return _deals[batchId];
    }

    function payeeOverride(bytes32 batchId) external view returns (address) {
        address p = _payee[batchId];
        return p == address(0) ? _deals[batchId].supplier : p;
    }

    /// @notice Supplier-only payout reassignment, mirroring the real escrow's access rule.
    function setPayee(bytes32 batchId, address payee) external {
        if (msg.sender != _deals[batchId].supplier) revert NotSupplier(batchId);
        _payee[batchId] = payee;
    }
}
