// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { ISettlementRouter } from "../interfaces/ISettlementRouter.sol";
import { ISettlementEscrow } from "../interfaces/ISettlementEscrow.sol";
import { IAttestationRegistry } from "../interfaces/IAttestationRegistry.sol";
import { IReputationEngine } from "../interfaces/IReputationEngine.sol";
import { Keys } from "../core/Keys.sol";

/// @title SettlementRouter
/// @notice One-call orchestration of the settlement pipeline: verifies an attestation exists and
///         the deal is funded, drives {SettlementEscrow.settle}, then records the outcome on the
///         optional {ReputationEngine}.
/// @dev Deps (AddressBook): SettlementEscrow, AttestationRegistry, ReputationEngine (optional),
///      FeeManager. Reputation recording is best-effort (never reverts a settlement). When a
///      deployment routes settlement through here, leave the escrow's own reputation hook unset so
///      outcomes are recorded exactly once.
contract SettlementRouter is ProofChainAccess, ISettlementRouter {
    /// @param addressBook_ Deployed AddressBook.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc ISettlementRouter
    function settleFull(bytes32 batchId) external override returns (bool released) {
        ISettlementEscrow escrow = ISettlementEscrow(_addr(Keys.SETTLEMENT_ESCROW));
        IAttestationRegistry attestations = IAttestationRegistry(_addr(Keys.ATTESTATION_REGISTRY));

        if (!attestations.isAttested(batchId)) revert NotAttested(batchId);

        ISettlementEscrow.Deal memory deal = escrow.getDeal(batchId);
        if (deal.state != ISettlementEscrow.DealState.Funded) revert NotFunded(batchId);

        uint16 score = attestations.scoreOf(batchId);

        // Drive the escrow: a passing score releases to the payee, a failing score disputes.
        escrow.settle(batchId);

        ISettlementEscrow.Deal memory settled = escrow.getDeal(batchId);
        released = settled.state == ISettlementEscrow.DealState.Released;

        _recordOutcome(deal.supplier, released, score);

        emit FullySettled(batchId, released, score);
        return released;
    }

    /// @dev Best-effort reputation recording via the optional {ReputationEngine}. A missing key or
    ///      an ungranted REPUTATION_UPDATER_ROLE degrades gracefully rather than bricking settle.
    function _recordOutcome(address supplier, bool passed, uint16 score) internal {
        address engine = _addrOrZero(Keys.REPUTATION_ENGINE);
        if (engine == address(0)) return;
        // solhint-disable-next-line no-empty-blocks
        try IReputationEngine(engine).recordOutcome(supplier, passed, score) { }
        catch { /* reputation is advisory; settlement already succeeded */ }
    }
}
