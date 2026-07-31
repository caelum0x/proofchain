// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { IDiscountCalculator } from "../interfaces/IDiscountCalculator.sol";

/// @title DiscountCalculator
/// @notice Computes the advance (discounted) amount payable now for a receivable, from its face
///         value, the supplier's risk grade (1 best .. 7 worst), and the tenor (days to maturity).
/// @dev Pure financial math with admin-tunable parameters. No fund movement, no peer calls.
///      Discount grows with worse grade and longer tenor, capped at {maxDiscountBps}.
contract DiscountCalculator is ProofChainAccess, IDiscountCalculator {
    /// @notice Basis-points denominator (100% == 10_000 bps).
    uint16 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Worst (highest) supported risk grade.
    uint8 public constant MAX_GRADE = 7;

    /// @notice Discount charged per grade step, in bps (grade * gradeStepBps).
    uint16 public gradeStepBps;

    /// @notice Discount charged per day of tenor, in bps.
    uint16 public dailyBps;

    /// @notice Hard cap on the total discount, in bps (protects suppliers from over-discounting).
    uint16 public maxDiscountBps;

    /// @notice Emitted when the discount curve parameters are updated.
    event DiscountParamsUpdated(uint16 gradeStepBps, uint16 dailyBps, uint16 maxDiscountBps);

    error InvalidParams();

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE (may tune the discount curve).
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        // Defaults: 0.50% per grade step, 0.02% per day, capped at 30%.
        gradeStepBps = 50;
        dailyBps = 2;
        maxDiscountBps = 3000;
    }

    /// @notice Update the discount curve parameters. Admin only.
    function setParams(uint16 gradeStepBps_, uint16 dailyBps_, uint16 maxDiscountBps_)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (maxDiscountBps_ == 0 || maxDiscountBps_ >= BPS_DENOMINATOR) revert InvalidParams();
        gradeStepBps = gradeStepBps_;
        dailyBps = dailyBps_;
        maxDiscountBps = maxDiscountBps_;
        emit DiscountParamsUpdated(gradeStepBps_, dailyBps_, maxDiscountBps_);
    }

    /// @inheritdoc IDiscountCalculator
    function discountBps(uint8 grade, uint256 tenorDays) public view returns (uint16) {
        if (grade == 0 || grade > MAX_GRADE) revert InvalidGrade(grade);

        // Grade and time components. Compute in uint256 to avoid overflow before the cap.
        uint256 gradeComponent = uint256(grade) * gradeStepBps;
        uint256 timeComponent = tenorDays * dailyBps;
        uint256 total = gradeComponent + timeComponent;

        uint256 cap = maxDiscountBps;
        if (total > cap) total = cap;
        return uint16(total);
    }

    /// @inheritdoc IDiscountCalculator
    function advanceFor(uint256 face, uint8 grade, uint256 tenorDays) external view returns (uint256) {
        if (face == 0) revert ZeroFaceValue();
        uint16 d = discountBps(grade, tenorDays);
        // advance = face * (1 - discount)
        return (face * (BPS_DENOMINATOR - d)) / BPS_DENOMINATOR;
    }
}
