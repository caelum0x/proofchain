// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { IKYCRegistry } from "../interfaces/IKYCRegistry.sol";
import { IAddressBook } from "../interfaces/IAddressBook.sol";
import { IPauser } from "../interfaces/IPauser.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";

/// @title KYCRegistry
/// @notice Per-address KYC status attested by accounts holding `KYC_PROVIDER_ROLE`.
/// @dev Does NOT inherit {ProofChainAccess} because {IKYCRegistry} declares its own `ZeroAddress`
///      error, which would collide with the base's. It resolves the optional global {Pauser}
///      through the {AddressBook} for parity with the rest of the platform.
contract KYCRegistry is AccessControl, IKYCRegistry {
    /// @notice The shared service registry used to resolve the optional global {Pauser}.
    IAddressBook public immutable addressBook;

    mapping(address => KycStatus) private _status;

    /// @param addressBook_ Deployed {AddressBook} (used for global-pause resolution).
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial KYC_PROVIDER_ROLE.
    constructor(address addressBook_, address admin) {
        if (addressBook_ == address(0) || admin == address(0)) revert ZeroAddress();
        addressBook = IAddressBook(addressBook_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.KYC_PROVIDER_ROLE, admin);
    }

    /// @inheritdoc IKYCRegistry
    function setKyc(address account, KycLevel level) external onlyRole(Roles.KYC_PROVIDER_ROLE) {
        _requireNotGloballyPaused();
        if (account == address(0)) revert ZeroAddress();

        _status[account] = KycStatus({ level: level, updatedAt: uint64(block.timestamp), provider: msg.sender });

        emit KycSet(account, level, msg.sender);
    }

    /// @inheritdoc IKYCRegistry
    function revokeKyc(address account) external onlyRole(Roles.KYC_PROVIDER_ROLE) {
        _requireNotGloballyPaused();
        if (account == address(0)) revert ZeroAddress();

        _status[account] =
            KycStatus({ level: KycLevel.None, updatedAt: uint64(block.timestamp), provider: msg.sender });

        emit KycRevoked(account, msg.sender);
    }

    /// @inheritdoc IKYCRegistry
    function kycOf(address account) external view returns (KycStatus memory) {
        return _status[account];
    }

    /// @inheritdoc IKYCRegistry
    function levelOf(address account) external view returns (KycLevel) {
        return _status[account].level;
    }

    /// @inheritdoc IKYCRegistry
    function isVerified(address account) external view returns (bool) {
        return _status[account].level >= KycLevel.Verified;
    }

    /// @dev Reverts if the optional global {Pauser} is wired and currently paused.
    function _requireNotGloballyPaused() private view {
        address pauser = addressBook.getAddress(Keys.PAUSER);
        if (pauser != address(0)) {
            IPauser(pauser).requireNotPaused();
        }
    }
}
