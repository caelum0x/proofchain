// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IDPPDataCarrier } from "../interfaces/IDPPDataCarrier.sol";
import { IDigitalProductPassport } from "../interfaces/IDigitalProductPassport.sol";

/// @title DPPDataCarrier
/// @notice Binds a Digital Product Passport to its physical data carrier (GS1 Digital Link / QR /
///         NFC / RFID / DataMatrix) and resolves a scanned carrier identifier back to its passport
///         token id. Supports re-issuance if a carrier is damaged or replaced, while enforcing at
///         most one active carrier per passport.
/// @dev Resolves the {DigitalProductPassport} through the {AddressBook}. Carriers are registered by
///      a passport's manufacturer or a {Roles.REGISTRAR_ROLE} holder.
contract DPPDataCarrier is ProofChainAccess, IDPPDataCarrier {
    /// @dev carrierId => carrier record.
    mapping(bytes32 => Carrier) private _carriers;

    /// @dev tokenId => currently active carrier id (bytes32(0) when none).
    mapping(uint256 => bytes32) private _activeCarrierOf;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the DigitalProductPassport.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial REGISTRAR_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.REGISTRAR_ROLE, admin);
    }

    /// @inheritdoc IDPPDataCarrier
    function registerCarrier(bytes32 carrierId, uint256 tokenId, CarrierType carrierType, string calldata uri)
        external
        override
    {
        _requireNotGloballyPaused();
        _requireManufacturerOrRegistrar(tokenId);
        _register(carrierId, tokenId, carrierType, uri);
    }

    /// @inheritdoc IDPPDataCarrier
    function deactivate(bytes32 carrierId) external override {
        _requireNotGloballyPaused();
        Carrier storage c = _carriers[carrierId];
        if (c.tokenId == 0) revert UnknownCarrier(carrierId);
        _requireManufacturerOrRegistrar(c.tokenId);
        if (!c.active) revert CarrierInactive(carrierId);

        c.active = false;
        _activeCarrierOf[c.tokenId] = bytes32(0);

        emit CarrierDeactivated(carrierId);
    }

    /// @inheritdoc IDPPDataCarrier
    function replaceCarrier(bytes32 oldCarrierId, bytes32 newCarrierId, CarrierType carrierType, string calldata uri)
        external
        override
    {
        _requireNotGloballyPaused();
        Carrier storage old = _carriers[oldCarrierId];
        if (old.tokenId == 0) revert UnknownCarrier(oldCarrierId);
        uint256 tokenId = old.tokenId;
        _requireManufacturerOrRegistrar(tokenId);
        if (!old.active) revert CarrierInactive(oldCarrierId);

        // Retire the old carrier, then bind the new one to the same passport atomically.
        old.active = false;
        _activeCarrierOf[tokenId] = bytes32(0);
        emit CarrierDeactivated(oldCarrierId);

        _register(newCarrierId, tokenId, carrierType, uri);

        emit CarrierReplaced(tokenId, oldCarrierId, newCarrierId);
    }

    /// @inheritdoc IDPPDataCarrier
    function resolve(bytes32 carrierId) external view override returns (uint256 tokenId) {
        Carrier storage c = _carriers[carrierId];
        if (c.tokenId == 0) revert UnknownCarrier(carrierId);
        if (!c.active) revert CarrierInactive(carrierId);
        return c.tokenId;
    }

    /// @inheritdoc IDPPDataCarrier
    function activeCarrierOf(uint256 tokenId) external view override returns (bytes32) {
        return _activeCarrierOf[tokenId];
    }

    /// @inheritdoc IDPPDataCarrier
    function carrierOf(bytes32 carrierId) external view override returns (Carrier memory) {
        return _carriers[carrierId];
    }

    /// @dev Register a new active carrier for a passport, enforcing a unique carrier id and the
    ///      single-active-carrier invariant.
    function _register(bytes32 carrierId, uint256 tokenId, CarrierType carrierType, string calldata uri) private {
        if (carrierId == bytes32(0)) revert UnknownCarrier(carrierId);
        if (_carriers[carrierId].tokenId != 0) revert CarrierExists(carrierId);
        // One active carrier per passport: an existing active carrier must be replaced/deactivated.
        bytes32 active = _activeCarrierOf[tokenId];
        if (active != bytes32(0)) revert CarrierExists(active);

        _carriers[carrierId] = Carrier({
            carrierId: carrierId,
            tokenId: tokenId,
            carrierType: carrierType,
            uri: uri,
            active: true,
            registeredAt: uint64(block.timestamp)
        });
        _activeCarrierOf[tokenId] = carrierId;

        emit CarrierRegistered(carrierId, tokenId, carrierType, uri);
    }

    /// @dev Enforce that the passport exists and the caller is its manufacturer or a registrar.
    function _requireManufacturerOrRegistrar(uint256 tokenId) private view {
        IDigitalProductPassport dpp = IDigitalProductPassport(_addr(Keys.DIGITAL_PRODUCT_PASSPORT));
        IDigitalProductPassport.Passport memory p = dpp.passportOf(tokenId);
        if (p.status == IDigitalProductPassport.PassportStatus.None) revert UnknownPassport(tokenId);
        if (msg.sender != p.manufacturer && !hasRole(Roles.REGISTRAR_ROLE, msg.sender)) {
            revert NotAuthorized(tokenId);
        }
    }
}
