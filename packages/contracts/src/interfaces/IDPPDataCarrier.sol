// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IDPPDataCarrier
/// @notice Binds a Digital Product Passport to its physical data carrier (GS1 Digital Link / QR / NFC /
///         RFID / DataMatrix). Resolves a scanned carrier identifier to its passport token id, supporting
///         re-issuance if a carrier is damaged/replaced. One active carrier per passport.
/// @dev deps (AddressBook): DigitalProductPassport.
interface IDPPDataCarrier {
    enum CarrierType {
        QRCode,
        DataMatrix,
        NFC,
        RFID,
        GS1DigitalLink
    }

    struct Carrier {
        bytes32 carrierId;
        uint256 tokenId;
        CarrierType carrierType;
        string uri;
        bool active;
        uint64 registeredAt;
    }

    event CarrierRegistered(bytes32 indexed carrierId, uint256 indexed tokenId, CarrierType carrierType, string uri);
    event CarrierDeactivated(bytes32 indexed carrierId);
    event CarrierReplaced(uint256 indexed tokenId, bytes32 indexed oldCarrierId, bytes32 indexed newCarrierId);

    error CarrierExists(bytes32 carrierId);
    error UnknownCarrier(bytes32 carrierId);
    error UnknownPassport(uint256 tokenId);
    error NotAuthorized(uint256 tokenId);
    error CarrierInactive(bytes32 carrierId);

    /// @notice Register a data carrier for a passport. REGISTRAR_ROLE or manufacturer.
    function registerCarrier(bytes32 carrierId, uint256 tokenId, CarrierType carrierType, string calldata uri) external;

    /// @notice Deactivate a carrier (lost/damaged) without replacing it.
    function deactivate(bytes32 carrierId) external;

    /// @notice Replace a passport's active carrier with a new one atomically.
    function replaceCarrier(bytes32 oldCarrierId, bytes32 newCarrierId, CarrierType carrierType, string calldata uri)
        external;

    /// @notice Resolve a scanned carrier id to its passport token id (reverts if inactive/unknown).
    function resolve(bytes32 carrierId) external view returns (uint256 tokenId);

    /// @notice The active carrier id bound to a passport (bytes32(0) if none).
    function activeCarrierOf(uint256 tokenId) external view returns (bytes32);

    function carrierOf(bytes32 carrierId) external view returns (Carrier memory);
}
