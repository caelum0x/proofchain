// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IReferralProgram
/// @notice Referral attribution and payout.
interface IReferralProgram {
    event Referred(address indexed referrer, address indexed referee);
    event ConversionRecorded(address indexed referee, uint256 value, uint256 reward);
    event ReferralClaimed(address indexed referrer, uint256 amount);

    error AlreadyReferred(address referee);
    error SelfReferral(address account);
    error NothingToClaim(address referrer);

    /// @notice Register that `msg.sender` was referred by `referrer`.
    function refer(address referrer) external;

    /// @notice Record a conversion for a referee, accruing a reward to its referrer.
    function recordConversion(address referee, uint256 value) external;

    /// @notice Claim accrued referral rewards.
    function claimReferral() external;

    function referrerOf(address referee) external view returns (address);
    function pendingReward(address referrer) external view returns (uint256);
}
