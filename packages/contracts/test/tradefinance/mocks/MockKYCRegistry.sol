// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal {IKYCRegistry} test double exposing only the `isVerified` read the
///         tradefinance module consults.
contract MockKYCRegistry {
    mapping(address => bool) private _verified;

    function setVerified(address account, bool v) external {
        _verified[account] = v;
    }

    function isVerified(address account) external view returns (bool) {
        return _verified[account];
    }
}
