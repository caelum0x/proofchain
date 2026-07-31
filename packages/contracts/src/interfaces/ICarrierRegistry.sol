// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICarrierRegistry
/// @notice Registry of logistics carriers permitted to push checkpoints.
interface ICarrierRegistry {
    struct Profile {
        address account;
        string name;
        string uri;
        uint64 registeredAt;
        bool exists;
    }

    event CarrierRegistered(address indexed account, string name, string uri);
    event CarrierUpdated(address indexed account, string name, string uri);

    error AlreadyRegistered(address account);
    error NotRegistered(address account);
    error EmptyName();

    function registerCarrier(string calldata name, string calldata uri) external;
    function updateCarrier(string calldata name, string calldata uri) external;

    function profileOf(address account) external view returns (Profile memory);
    function isCarrier(address account) external view returns (bool);
}
