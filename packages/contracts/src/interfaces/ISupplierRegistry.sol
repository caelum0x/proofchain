// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISupplierRegistry
/// @notice Supplier self-service profile registry.
interface ISupplierRegistry {
    struct Profile {
        address account;
        string name;
        string uri;
        uint64 registeredAt;
        bool exists;
    }

    event SupplierRegistered(address indexed account, string name, string uri);
    event SupplierUpdated(address indexed account, string name, string uri);

    error AlreadyRegistered(address account);
    error NotRegistered(address account);
    error EmptyName();

    function registerSupplier(string calldata name, string calldata uri) external;
    function updateSupplier(string calldata name, string calldata uri) external;

    function profileOf(address account) external view returns (Profile memory);
    function isSupplier(address account) external view returns (bool);
}
