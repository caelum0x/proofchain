// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IScoreOracle } from "../interfaces/IScoreOracle.sol";
import { IReputationEngine } from "../interfaces/IReputationEngine.sol";
import { IKYCRegistry } from "../interfaces/IKYCRegistry.sol";

/// @title ScoreOracle
/// @notice Blends a supplier's on-chain reputation history with KYC status into a composite risk
///         grade of 1 (best) .. 7 (worst); 0 means ungraded / insufficient data.
/// @dev The composite score (0..10000 bps) is a weighted blend of the reputation component
///      (average attestation score + pass rate) and the KYC component (verification level). Admins
///      tune the weights, which must sum to 10000. Peers resolve through the {AddressBook}: the
///      {ReputationEngine} is required, the {KYCRegistry} is optional (missing => KYC level 0).
contract ScoreOracle is ProofChainAccess, IScoreOracle {
    /// @notice Full basis-point scale.
    uint16 public constant MAX_BPS = 10_000;

    /// @notice Highest KYC enum level ({IKYCRegistry.KycLevel.Enhanced} == 3).
    uint8 public constant MAX_KYC_LEVEL = 3;

    /// @notice Weight applied to the reputation component (bps of the composite score).
    uint16 public reputationWeightBps;

    /// @notice Weight applied to the KYC component (bps of the composite score).
    uint16 public kycWeightBps;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        reputationWeightBps = 7000;
        kycWeightBps = 3000;
        emit GradeParamsUpdated(7000, 3000);
    }

    /// @notice Update the blend weights. Admin only. Weights must sum to exactly 10000.
    function setGradeParams(uint16 reputationWeightBps_, uint16 kycWeightBps_)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (uint256(reputationWeightBps_) + kycWeightBps_ != MAX_BPS) revert InvalidWeights();
        reputationWeightBps = reputationWeightBps_;
        kycWeightBps = kycWeightBps_;
        emit GradeParamsUpdated(reputationWeightBps_, kycWeightBps_);
    }

    /// @inheritdoc IScoreOracle
    function gradeOf(address supplier) external view override returns (uint8) {
        if (supplier == address(0)) return 0;

        IReputationEngine reputation = IReputationEngine(_addr(Keys.REPUTATION_ENGINE));
        (uint16 avgScoreBps, uint256 totalDeals, uint16 passRateBps,) = reputation.reputationOf(supplier);

        // Insufficient history to grade.
        if (totalDeals == 0) return 0;

        // Reputation component: equal blend of average score and pass rate (both already 0..10000).
        uint256 repComponent = (uint256(avgScoreBps) + uint256(passRateBps)) / 2;

        // KYC component: scale the verification level (0..3) onto 0..10000. Optional dependency.
        uint256 kycComponent;
        address kycAddr = _addrOrZero(Keys.KYC_REGISTRY);
        if (kycAddr != address(0)) {
            uint8 level = uint8(IKYCRegistry(kycAddr).levelOf(supplier));
            if (level > MAX_KYC_LEVEL) level = MAX_KYC_LEVEL;
            kycComponent = (uint256(level) * MAX_BPS) / MAX_KYC_LEVEL;
        }

        uint256 composite = (repComponent * reputationWeightBps + kycComponent * kycWeightBps) / MAX_BPS;
        return _grade(composite);
    }

    /// @dev Map a composite score (0..10000) to a discrete risk grade 1 (best) .. 7 (worst).
    function _grade(uint256 composite) private pure returns (uint8) {
        if (composite >= 9000) return 1;
        if (composite >= 8000) return 2;
        if (composite >= 7000) return 3;
        if (composite >= 5500) return 4;
        if (composite >= 4000) return 5;
        if (composite >= 2500) return 6;
        return 7;
    }
}
