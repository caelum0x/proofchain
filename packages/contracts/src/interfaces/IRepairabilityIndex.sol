// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IRepairabilityIndex
/// @notice Computes a French-style repairability/durability index (0-100, scaled to two decimals in
///         hundredths) for a passport from weighted sub-criteria: documentation, disassembly, spare-part
///         availability, spare-part price, and software support. Scores gate eco-design/DPP disclosures.
/// @dev deps (AddressBook): DigitalProductPassport.
interface IRepairabilityIndex {
    struct Criteria {
        uint16 documentation;
        uint16 disassembly;
        uint16 spareAvailability;
        uint16 sparePricing;
        uint16 softwareSupport;
    }

    struct Weights {
        uint16 documentationW;
        uint16 disassemblyW;
        uint16 spareAvailabilityW;
        uint16 sparePricingW;
        uint16 softwareSupportW;
    }

    event WeightsSet(uint16 documentationW, uint16 disassemblyW, uint16 spareAvailabilityW, uint16 sparePricingW, uint16 softwareSupportW);
    event ScoreSet(uint256 indexed tokenId, uint16 score, address indexed assessor);

    error UnknownPassport(uint256 tokenId);
    error NotAssessed(uint256 tokenId);
    error CriterionOutOfRange(uint16 value);
    error InvalidWeights(uint16 total);

    /// @notice Configure sub-criteria weights (must sum to 10000 bps). GOVERNOR_ROLE only.
    function setWeights(Weights calldata weights) external;

    /// @notice Record sub-criteria scores (each 0-10000) and compute the index. INSPECTOR_ROLE only.
    /// @return score The computed repairability index (0-10000).
    function assess(uint256 tokenId, Criteria calldata criteria) external returns (uint16 score);

    /// @notice The stored repairability index for a passport (0-10000).
    function scoreOf(uint256 tokenId) external view returns (uint16);

    /// @notice The recorded sub-criteria for a passport.
    function criteriaOf(uint256 tokenId) external view returns (Criteria memory);

    /// @notice Current sub-criteria weights.
    function weights() external view returns (Weights memory);
}
