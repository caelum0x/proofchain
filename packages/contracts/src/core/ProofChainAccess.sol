// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { IAddressBook } from "../interfaces/IAddressBook.sol";
import { IPauser } from "../interfaces/IPauser.sol";
import { Keys } from "./Keys.sol";

/// @title ProofChainAccess
/// @notice Abstract base for every platform module. Holds the {AddressBook}, exposes an
///         `_addr(key)` resolver, and layers OpenZeppelin `AccessControl` on top.
/// @dev Modules inherit this instead of wiring peer addresses through their own constructors:
///      they resolve dependencies lazily via `_addr(Keys.SOME_CONTRACT)`.
abstract contract ProofChainAccess is AccessControl {
    /// @notice The shared service registry all peers are resolved through.
    IAddressBook public immutable addressBook;

    /// @notice A required address argument was the zero address.
    /// @dev Canonical declaration for the platform; modules inherit it via this base and the
    ///      module interfaces intentionally do NOT redeclare it (avoids inheritance collisions).
    error ZeroAddress();

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) {
        if (addressBook_ == address(0) || admin == address(0)) revert ZeroAddress();
        addressBook = IAddressBook(addressBook_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Resolve a peer contract by key, reverting if it is not registered.
    function _addr(bytes32 key) internal view returns (address) {
        return addressBook.requireAddress(key);
    }

    /// @notice Resolve a peer contract by key, returning the zero address if unset.
    /// @dev Use for OPTIONAL dependencies (e.g. an optional ReputationEngine hook).
    function _addrOrZero(bytes32 key) internal view returns (address) {
        return addressBook.getAddress(key);
    }

    /// @notice Revert if the global {Pauser} guardian has paused the protocol.
    /// @dev No-op when the Pauser key is unset, so modules degrade gracefully pre-wiring.
    function _requireNotGloballyPaused() internal view {
        address pauser = addressBook.getAddress(Keys.PAUSER);
        if (pauser != address(0)) {
            IPauser(pauser).requireNotPaused();
        }
    }
}
