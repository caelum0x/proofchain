// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { Keys } from "../core/Keys.sol";
import { IHarvestRegistry } from "../interfaces/IHarvestRegistry.sol";

/// @title HarvestRegistry
/// @notice Ground-truth record of agricultural harvest lots. A producer (or a REGISTRAR operator on their
///         behalf) registers a harvest — crop, farm geolocation, season, quantity — which becomes the
///         provenance root that downstream grading, storage receipts and tokenization all reference.
/// @dev State machine: None → Registered → Graded → Stored → (Consumed). Cross-domain transitions are
///      driven by the domain peers resolved through the {AddressBook}: the {GradingRegistry} calls
///      {markGraded} when it records a grading for the lot, and the {StorageReceipt} contract calls
///      {markStored} when the lot is warehoused. Peer addresses are never hardcoded.
contract HarvestRegistry is ProofChainAccess, IHarvestRegistry {
    /// @dev harvestId => harvest record.
    mapping(bytes32 => Harvest) private _harvests;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IHarvestRegistry
    function registerHarvest(
        bytes32 harvestId,
        address producer,
        bytes32 crop,
        bytes32 farmGeohash,
        bytes32 season,
        uint256 quantityKg,
        uint64 harvestedAt,
        bytes32 metadataHash
    ) external override {
        _requireNotGloballyPaused();
        if (producer == address(0)) revert ZeroAddress();
        if (quantityKg == 0) revert ZeroQuantity();
        // REGISTRAR operators may register on behalf of a producer; otherwise producers self-register.
        if (msg.sender != producer && !hasRole(Roles.REGISTRAR_ROLE, msg.sender)) {
            revert NotProducer(harvestId);
        }
        if (_harvests[harvestId].state != HarvestState.None) revert HarvestExists(harvestId);

        _harvests[harvestId] = Harvest({
            harvestId: harvestId,
            producer: producer,
            crop: crop,
            farmGeohash: farmGeohash,
            season: season,
            quantityKg: quantityKg,
            harvestedAt: harvestedAt,
            metadataHash: metadataHash,
            state: HarvestState.Registered
        });

        emit HarvestRegistered(harvestId, producer, crop, quantityKg, season);
        emit StateChanged(harvestId, HarvestState.Registered);
    }

    /// @inheritdoc IHarvestRegistry
    function adjustQuantity(bytes32 harvestId, uint256 newQuantityKg) external override {
        _requireNotGloballyPaused();
        if (newQuantityKg == 0) revert ZeroQuantity();

        Harvest storage h = _load(harvestId);
        if (msg.sender != h.producer && !hasRole(Roles.REGISTRAR_ROLE, msg.sender)) {
            revert NotProducer(harvestId);
        }
        // Quantity may only be corrected before the lot is warehoused (Registered or Graded).
        if (h.state != HarvestState.Registered && h.state != HarvestState.Graded) {
            revert InvalidState(harvestId, HarvestState.Registered, h.state);
        }

        uint256 old = h.quantityKg;
        h.quantityKg = newQuantityKg;
        emit QuantityAdjusted(harvestId, old, newQuantityKg);
    }

    /// @inheritdoc IHarvestRegistry
    /// @dev Callable by a GRADER or the registered {GradingRegistry} peer once the lot is Registered.
    function markGraded(bytes32 harvestId, bytes32 grade) external override {
        _requireNotGloballyPaused();
        if (!hasRole(Roles.GRADER_ROLE, msg.sender) && msg.sender != _addrOrZero(Keys.GRADING_REGISTRY)) {
            revert NotProducer(harvestId);
        }

        Harvest storage h = _load(harvestId);
        if (h.state != HarvestState.Registered) {
            revert InvalidState(harvestId, HarvestState.Registered, h.state);
        }

        h.state = HarvestState.Graded;
        emit HarvestGraded(harvestId, grade);
        emit StateChanged(harvestId, HarvestState.Graded);
    }

    /// @inheritdoc IHarvestRegistry
    /// @dev Callable by a REGISTRAR operator or the registered {StorageReceipt} peer once the lot is Graded.
    function markStored(bytes32 harvestId, bytes32 receiptId) external override {
        _requireNotGloballyPaused();
        if (!hasRole(Roles.REGISTRAR_ROLE, msg.sender) && msg.sender != _addrOrZero(Keys.STORAGE_RECEIPT)) {
            revert NotProducer(harvestId);
        }

        Harvest storage h = _load(harvestId);
        if (h.state != HarvestState.Graded) {
            revert InvalidState(harvestId, HarvestState.Graded, h.state);
        }

        h.state = HarvestState.Stored;
        emit HarvestStored(harvestId, receiptId);
        emit StateChanged(harvestId, HarvestState.Stored);
    }

    /// @inheritdoc IHarvestRegistry
    function harvestOf(bytes32 harvestId) external view override returns (Harvest memory) {
        return _harvests[harvestId];
    }

    /// @dev Load a harvest, reverting {UnknownHarvest} if it was never registered.
    function _load(bytes32 harvestId) private view returns (Harvest storage h) {
        h = _harvests[harvestId];
        if (h.state == HarvestState.None) revert UnknownHarvest(harvestId);
    }
}
