// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IAddressBook
/// @notice Central `bytes32 key -> address` service registry. Every module resolves its
///         peer dependencies through this book instead of hardcoding constructor addresses.
interface IAddressBook {
    /// @notice Emitted whenever a key is (re)pointed to an address.
    event AddressSet(bytes32 indexed key, address indexed oldAddr, address indexed newAddr);

    error ZeroKey();
    error ZeroAddress();
    error AddressNotFound(bytes32 key);

    /// @notice Point `key` at `addr`. Admin only.
    function setAddress(bytes32 key, address addr) external;

    /// @notice Resolve `key`; returns the zero address when unset.
    function getAddress(bytes32 key) external view returns (address);

    /// @notice Resolve `key`; reverts `AddressNotFound` when unset.
    function requireAddress(bytes32 key) external view returns (address);
}
