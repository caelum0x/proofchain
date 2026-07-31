// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IProvenanceFactory } from "../interfaces/IProvenanceFactory.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title ProvenanceFactory
/// @notice Templated batch registration. A creator defines a reusable {Series} (shared
///         metadata) once, then mints many batches from it without re-supplying metadata.
/// @dev Registers batches on the {ProvenanceRegistry} resolved via the {AddressBook}. The
///      factory itself is the `msg.sender` to the registry, so the deployer must grant this
///      contract `REGISTRAR_ROLE` on the registry for `registerFromSeries` to succeed.
contract ProvenanceFactory is ProofChainAccess, IProvenanceFactory {
    /// @dev seriesId => series template.
    mapping(bytes32 => Series) private _series;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the ProvenanceRegistry.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IProvenanceFactory
    function createSeries(bytes32 seriesId, string calldata metadataURI) external {
        _requireNotGloballyPaused();

        if (_series[seriesId].exists) revert SeriesExists(seriesId);
        if (bytes(metadataURI).length == 0) revert EmptyMetadata();

        _series[seriesId] = Series({
            seriesId: seriesId,
            creator: msg.sender,
            metadataURI: metadataURI,
            createdAt: uint64(block.timestamp),
            count: 0,
            exists: true
        });

        emit SeriesCreated(seriesId, msg.sender, metadataURI);
    }

    /// @inheritdoc IProvenanceFactory
    function registerFromSeries(bytes32 seriesId, bytes32 batchId, bytes32 originHash) external {
        _requireNotGloballyPaused();

        Series storage s = _series[seriesId];
        if (!s.exists) revert UnknownSeries(seriesId);
        if (s.creator != msg.sender) revert NotSeriesCreator(seriesId);

        // Index of this batch within the series (0-based); bump the counter afterwards.
        uint256 index = s.count;

        // Reuses the series metadata; a duplicate batchId reverts BatchExists inside the registry.
        IProvenanceRegistry(_addr(Keys.PROVENANCE_REGISTRY)).registerBatch(batchId, originHash, s.metadataURI);

        s.count = index + 1;

        emit RegisteredFromSeries(seriesId, batchId, index);
    }

    /// @inheritdoc IProvenanceFactory
    function seriesOf(bytes32 seriesId) external view returns (Series memory) {
        return _series[seriesId];
    }
}
