// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { IAddressBook } from "../interfaces/IAddressBook.sol";

/// @title AddressBook
/// @notice Central `bytes32 key -> address` registry every module resolves peers through.
/// @dev Admin (typically the deployer, later the timelock) points keys at deployed contracts.
///      Events/errors are declared on {IAddressBook} and inherited here to avoid duplication.
contract AddressBook is AccessControl, IAddressBook {
    mapping(bytes32 => address) private _addresses;

    /// @param admin Address granted DEFAULT_ADMIN_ROLE (the only role allowed to set keys).
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @inheritdoc IAddressBook
    function setAddress(bytes32 key, address addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (key == bytes32(0)) revert ZeroKey();
        if (addr == address(0)) revert ZeroAddress();
        address old = _addresses[key];
        _addresses[key] = addr;
        emit AddressSet(key, old, addr);
    }

    /// @inheritdoc IAddressBook
    function getAddress(bytes32 key) external view returns (address) {
        return _addresses[key];
    }

    /// @inheritdoc IAddressBook
    function requireAddress(bytes32 key) external view returns (address) {
        address addr = _addresses[key];
        if (addr == address(0)) revert AddressNotFound(key);
        return addr;
    }
}
