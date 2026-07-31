// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ISustainabilityOracle } from "../interfaces/ISustainabilityOracle.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title SustainabilityOracle
/// @notice Keeper-fed emissions oracle. Trusted keepers push measured CO2-equivalent (grams)
///         footprints for registered batches; the latest value is the batch's canonical footprint.
/// @dev Resolves the {ProvenanceRegistry} via the {AddressBook} and refuses to record emissions
///      for batches that do not exist in the ground-truth registry. Consumed by the
///      {OffsetMarketplace} to compute a batch's remaining, un-offset footprint.
contract SustainabilityOracle is ProofChainAccess, ISustainabilityOracle {
    /// @dev batchId => latest recorded CO2e (grams).
    mapping(bytes32 => uint256) private _emissions;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the ProvenanceRegistry.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial KEEPER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.KEEPER_ROLE, admin);
    }

    /// @inheritdoc ISustainabilityOracle
    function pushEmissions(bytes32 batchId, uint256 co2e) external override {
        _requireNotGloballyPaused();

        // Custom-error access control so integrators get the documented {NotKeeper} revert.
        if (!hasRole(Roles.KEEPER_ROLE, msg.sender)) revert NotKeeper(msg.sender);

        IProvenanceRegistry registry = IProvenanceRegistry(_addr(Keys.PROVENANCE_REGISTRY));
        if (!registry.batchExists(batchId)) revert UnknownBatch(batchId);

        _emissions[batchId] = co2e;
        emit EmissionsPushed(batchId, co2e, msg.sender);
    }

    /// @inheritdoc ISustainabilityOracle
    function emissionsOf(bytes32 batchId) external view override returns (uint256) {
        return _emissions[batchId];
    }
}
