// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IScoreOracle
/// @notice Blends AI attestation score + reputation history + KYC into a composite risk grade.
/// @dev deps (AddressBook): ReputationEngine, KYCRegistry. Grade is 1 (best) .. 7 (worst),
///      0 == ungraded/insufficient data.
interface IScoreOracle {
    event GradeParamsUpdated(uint16 reputationWeightBps, uint16 kycWeightBps);

    error InvalidWeights();

    /// @notice Composite risk grade for a supplier (0 = ungraded, 1 = best .. 7 = worst).
    function gradeOf(address supplier) external view returns (uint8);
}
