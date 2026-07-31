// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IDPPLifecycleRegistry } from "../interfaces/IDPPLifecycleRegistry.sol";
import { IDigitalProductPassport } from "../interfaces/IDigitalProductPassport.sol";

/// @title DPPLifecycleRegistry
/// @notice Append-only lifecycle event log for Digital Product Passports: manufacturing, sale,
///         service, repair, refurbishment, recycling and disposal. Each event commits to an
///         off-chain payload hash and is attributed to its actor, giving every passport a
///         tamper-evident, chronologically ordered history.
/// @dev Resolves the {DigitalProductPassport} through the {AddressBook}. Events can be appended by
///      a trusted {Roles.REGISTRAR_ROLE} (e.g. repair networks, recyclers) or by the passport's
///      current owner — never deleted or mutated once written.
contract DPPLifecycleRegistry is ProofChainAccess, IDPPLifecycleRegistry {
    /// @dev tokenId => ordered lifecycle events.
    mapping(uint256 => LifecycleEvent[]) private _events;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the DigitalProductPassport.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial REGISTRAR_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.REGISTRAR_ROLE, admin);
    }

    /// @inheritdoc IDPPLifecycleRegistry
    function record(uint256 tokenId, EventType eventType, bytes32 dataHash, string calldata location)
        external
        override
        returns (uint256 index)
    {
        _requireNotGloballyPaused();

        IDigitalProductPassport dpp = IDigitalProductPassport(_addr(Keys.DIGITAL_PRODUCT_PASSPORT));
        IDigitalProductPassport.Passport memory p = dpp.passportOf(tokenId);
        if (p.status == IDigitalProductPassport.PassportStatus.None) revert UnknownPassport(tokenId);

        // Only the passport's current owner or a trusted registrar may append history.
        if (msg.sender != dpp.ownerOf(tokenId) && !hasRole(Roles.REGISTRAR_ROLE, msg.sender)) {
            revert NotAuthorized(tokenId);
        }

        index = _events[tokenId].length;
        _events[tokenId].push(
            LifecycleEvent({
                tokenId: tokenId,
                eventType: eventType,
                actor: msg.sender,
                dataHash: dataHash,
                location: location,
                timestamp: uint64(block.timestamp)
            })
        );

        emit LifecycleRecorded(tokenId, index, eventType, msg.sender, dataHash);
    }

    /// @inheritdoc IDPPLifecycleRegistry
    function eventCount(uint256 tokenId) external view override returns (uint256) {
        return _events[tokenId].length;
    }

    /// @inheritdoc IDPPLifecycleRegistry
    function eventAt(uint256 tokenId, uint256 index) external view override returns (LifecycleEvent memory) {
        if (index >= _events[tokenId].length) revert IndexOutOfRange(tokenId, index);
        return _events[tokenId][index];
    }
}
