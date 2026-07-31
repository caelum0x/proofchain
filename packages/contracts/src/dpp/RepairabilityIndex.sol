// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IRepairabilityIndex } from "../interfaces/IRepairabilityIndex.sol";
import { IDigitalProductPassport } from "../interfaces/IDigitalProductPassport.sol";

/// @title RepairabilityIndex
/// @notice Computes a French-style repairability / durability index (0–10000 bps, i.e. 0.00–100.00)
///         for a Digital Product Passport from five weighted sub-criteria: documentation,
///         disassembly, spare-part availability, spare-part pricing and software support. The score
///         gates eco-design / DPP disclosures.
/// @dev Resolves the {DigitalProductPassport} through the {AddressBook}. Weights are governed by
///      {Roles.GOVERNOR_ROLE} and must sum to exactly 10000; assessments are written by
///      {Roles.INSPECTOR_ROLE}.
contract RepairabilityIndex is ProofChainAccess, IRepairabilityIndex {
    /// @dev 100.00% expressed in basis points.
    uint16 private constant BPS_DENOMINATOR = 10_000;

    Weights private _weights;

    /// @dev tokenId => recorded sub-criteria.
    mapping(uint256 => Criteria) private _criteria;

    /// @dev tokenId => computed index (bps).
    mapping(uint256 => uint16) private _scores;

    /// @dev tokenId => whether an assessment has been recorded (0 is a valid score).
    mapping(uint256 => bool) private _assessed;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the DigitalProductPassport.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE plus the initial GOVERNOR_ROLE and
    ///        INSPECTOR_ROLE. Defaults to equal 20% weights (the French repairability convention).
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.GOVERNOR_ROLE, admin);
        _grantRole(Roles.INSPECTOR_ROLE, admin);

        _weights = Weights({
            documentationW: 2000,
            disassemblyW: 2000,
            spareAvailabilityW: 2000,
            sparePricingW: 2000,
            softwareSupportW: 2000
        });
        emit WeightsSet(2000, 2000, 2000, 2000, 2000);
    }

    /// @inheritdoc IRepairabilityIndex
    function setWeights(Weights calldata weights_) external override onlyRole(Roles.GOVERNOR_ROLE) {
        _requireNotGloballyPaused();
        uint256 total = uint256(weights_.documentationW) + weights_.disassemblyW + weights_.spareAvailabilityW
            + weights_.sparePricingW + weights_.softwareSupportW;
        if (total != BPS_DENOMINATOR) revert InvalidWeights(uint16(total));

        _weights = weights_;
        emit WeightsSet(
            weights_.documentationW,
            weights_.disassemblyW,
            weights_.spareAvailabilityW,
            weights_.sparePricingW,
            weights_.softwareSupportW
        );
    }

    /// @inheritdoc IRepairabilityIndex
    function assess(uint256 tokenId, Criteria calldata criteria)
        external
        override
        onlyRole(Roles.INSPECTOR_ROLE)
        returns (uint16 score)
    {
        _requireNotGloballyPaused();

        IDigitalProductPassport dpp = IDigitalProductPassport(_addr(Keys.DIGITAL_PRODUCT_PASSPORT));
        IDigitalProductPassport.Passport memory p = dpp.passportOf(tokenId);
        if (p.status == IDigitalProductPassport.PassportStatus.None) revert UnknownPassport(tokenId);

        _checkCriterion(criteria.documentation);
        _checkCriterion(criteria.disassembly);
        _checkCriterion(criteria.spareAvailability);
        _checkCriterion(criteria.sparePricing);
        _checkCriterion(criteria.softwareSupport);

        Weights memory w = _weights;
        // Weighted average: sum(criterion_i * weight_i) / 10000, with weights summing to 10000
        // this yields a result in [0, 10000].
        uint256 weighted = uint256(criteria.documentation) * w.documentationW
            + uint256(criteria.disassembly) * w.disassemblyW
            + uint256(criteria.spareAvailability) * w.spareAvailabilityW
            + uint256(criteria.sparePricing) * w.sparePricingW
            + uint256(criteria.softwareSupport) * w.softwareSupportW;
        score = uint16(weighted / BPS_DENOMINATOR);

        _criteria[tokenId] = criteria;
        _scores[tokenId] = score;
        _assessed[tokenId] = true;

        emit ScoreSet(tokenId, score, msg.sender);
    }

    /// @inheritdoc IRepairabilityIndex
    function scoreOf(uint256 tokenId) external view override returns (uint16) {
        if (!_assessed[tokenId]) revert NotAssessed(tokenId);
        return _scores[tokenId];
    }

    /// @inheritdoc IRepairabilityIndex
    function criteriaOf(uint256 tokenId) external view override returns (Criteria memory) {
        if (!_assessed[tokenId]) revert NotAssessed(tokenId);
        return _criteria[tokenId];
    }

    /// @inheritdoc IRepairabilityIndex
    function weights() external view override returns (Weights memory) {
        return _weights;
    }

    /// @dev Each sub-criterion must be a value in [0, 10000] bps.
    function _checkCriterion(uint16 value) private pure {
        if (value > BPS_DENOMINATOR) revert CriterionOutOfRange(value);
    }
}
