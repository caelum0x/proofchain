// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IExportLicenseRegistry
/// @notice Export/import license and dual-use control register. Licensing authorities grant licenses to
///         an exporter for a commodity code toward a destination, with a quantity cap that is drawn down
///         per shipment. Licenses can be suspended or revoked; the compliance engine gates on validity.
/// @dev deps (AddressBook): OrganizationRegistry, TradeComplianceEngine.
interface IExportLicenseRegistry {
    enum LicenseState {
        None,
        Active,
        Suspended,
        Revoked,
        Exhausted,
        Expired
    }

    struct License {
        bytes32 licenseId;
        address exporter;
        bytes32 commodityCode;
        bytes32 destinationCountry;
        uint256 quantityCap;
        uint256 quantityUsed;
        address authority;
        uint64 issuedAt;
        uint64 expiry;
        LicenseState state;
    }

    event Granted(
        bytes32 indexed licenseId,
        address indexed exporter,
        bytes32 indexed commodityCode,
        bytes32 destinationCountry,
        uint256 quantityCap,
        uint64 expiry
    );
    event Drawn(bytes32 indexed licenseId, uint256 quantity, uint256 totalUsed);
    event Suspended(bytes32 indexed licenseId, string reason);
    event Reinstated(bytes32 indexed licenseId);
    event Revoked(bytes32 indexed licenseId, string reason);

    error LicenseExists(bytes32 licenseId);
    error UnknownLicense(bytes32 licenseId);
    error InvalidState(bytes32 licenseId, LicenseState expected, LicenseState actual);
    error NotAuthority(bytes32 licenseId);
    error CapExceeded(uint256 requested, uint256 remaining);
    error ZeroQuantity();
    error PastExpiry(uint64 expiry);

    /// @notice Grant an export license. COMPLIANCE_OFFICER_ROLE only.
    function grant(
        bytes32 licenseId,
        address exporter,
        bytes32 commodityCode,
        bytes32 destinationCountry,
        uint256 quantityCap,
        uint64 expiry
    ) external;

    /// @notice Draw down the license quantity for a shipment.
    function draw(bytes32 licenseId, uint256 quantity) external;

    /// @notice Suspend an active license.
    function suspend(bytes32 licenseId, string calldata reason) external;

    /// @notice Reinstate a suspended license.
    function reinstate(bytes32 licenseId) external;

    /// @notice Revoke a license permanently.
    function revoke(bytes32 licenseId, string calldata reason) external;

    /// @notice True if the license is Active, unexpired, and has remaining quantity.
    function isValid(bytes32 licenseId) external view returns (bool);

    function licenseOf(bytes32 licenseId) external view returns (License memory);
}
