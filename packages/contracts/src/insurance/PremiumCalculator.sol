// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IPremiumCalculator } from "../interfaces/IPremiumCalculator.sol";

/// @title PremiumCalculator
/// @notice Computes insurance premiums from coverage and a supplier's risk grade.
/// @dev Pure financial math: `premium = coverage * premiumBps(grade) / 10_000`.
///      Per-grade rates are admin/pool-manager configurable so governance can retune pricing
///      without a redeploy. Grades run 1 (best) .. 7 (worst); grade 0 (ungraded) is rejected —
///      callers (PolicyManager) clamp ungraded suppliers to a sensible default before pricing.
contract PremiumCalculator is ProofChainAccess, IPremiumCalculator {
    /// @notice Basis-points denominator (100% = 10_000 bps).
    uint16 public constant MAX_BPS = 10_000;

    /// @notice Worst (highest-risk) supported grade.
    uint8 public constant MAX_GRADE = 7;

    /// @notice Per-grade premium rate in basis points (grade => bps).
    mapping(uint8 => uint16) private _premiumBps;

    /// @notice Emitted when a grade's premium rate is updated.
    event PremiumBpsUpdated(uint8 indexed grade, uint16 oldBps, uint16 newBps);

    /// @param addressBook_ Deployed AddressBook.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and POOL_MANAGER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.POOL_MANAGER_ROLE, admin);

        // Sensible defaults: risk-monotonic premium curve from 1% (grade 1) to 15% (grade 7).
        _premiumBps[1] = 100; // 1.00%
        _premiumBps[2] = 150; // 1.50%
        _premiumBps[3] = 250; // 2.50%
        _premiumBps[4] = 400; // 4.00%
        _premiumBps[5] = 600; // 6.00%
        _premiumBps[6] = 900; // 9.00%
        _premiumBps[7] = 1500; // 15.00%
    }

    /// @notice Update the premium rate (bps) for a grade. Pool manager only.
    function setPremiumBps(uint8 grade, uint16 bps) external onlyRole(Roles.POOL_MANAGER_ROLE) {
        if (grade == 0 || grade > MAX_GRADE) revert InvalidGrade(grade);
        if (bps > MAX_BPS) revert InvalidGrade(grade); // rate cannot exceed 100%
        uint16 old = _premiumBps[grade];
        _premiumBps[grade] = bps;
        emit PremiumBpsUpdated(grade, old, bps);
    }

    /// @inheritdoc IPremiumCalculator
    function premiumFor(uint256 coverage, uint8 grade) external view returns (uint256) {
        if (coverage == 0) revert ZeroCoverage();
        uint16 bps = premiumBps(grade);
        return (coverage * bps) / MAX_BPS;
    }

    /// @inheritdoc IPremiumCalculator
    function premiumBps(uint8 grade) public view returns (uint16) {
        if (grade == 0 || grade > MAX_GRADE) revert InvalidGrade(grade);
        return _premiumBps[grade];
    }
}
