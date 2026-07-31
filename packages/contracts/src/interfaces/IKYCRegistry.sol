// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IKYCRegistry
/// @notice Per-address KYC status set by accounts holding KYC_PROVIDER_ROLE.
interface IKYCRegistry {
    /// @dev Higher levels indicate stronger verification. Level 0 == not verified.
    enum KycLevel {
        None,
        Basic,
        Verified,
        Enhanced
    }

    struct KycStatus {
        KycLevel level;
        uint64 updatedAt;
        address provider;
    }

    event KycSet(address indexed account, KycLevel level, address indexed provider);
    event KycRevoked(address indexed account, address indexed provider);

    error ZeroAddress();

    function setKyc(address account, KycLevel level) external;
    function revokeKyc(address account) external;

    function kycOf(address account) external view returns (KycStatus memory);
    function levelOf(address account) external view returns (KycLevel);
    function isVerified(address account) external view returns (bool);
}
