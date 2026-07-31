// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IBuyerRegistry
/// @notice Buyer self-service profile registry (same shape as SupplierRegistry).
interface IBuyerRegistry {
    struct Profile {
        address account;
        string name;
        string uri;
        uint64 registeredAt;
        bool exists;
    }

    event BuyerRegistered(address indexed account, string name, string uri);
    event BuyerUpdated(address indexed account, string name, string uri);

    error AlreadyRegistered(address account);
    error NotRegistered(address account);
    error EmptyName();

    function registerBuyer(string calldata name, string calldata uri) external;
    function updateBuyer(string calldata name, string calldata uri) external;

    function profileOf(address account) external view returns (Profile memory);
    function isBuyer(address account) external view returns (bool);
}
