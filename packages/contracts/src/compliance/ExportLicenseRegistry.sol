// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IExportLicenseRegistry } from "../interfaces/IExportLicenseRegistry.sol";

/// @title ExportLicenseRegistry
/// @notice Export/dual-use control register. A licensing authority (COMPLIANCE_OFFICER_ROLE) grants an
///         exporter a quantity-capped license for a commodity code toward a destination. Shipments draw
///         the cap down; licenses can be suspended, reinstated or revoked by the granting authority.
/// @dev Peers resolved via the {AddressBook}. `isValid` (Active + unexpired + remaining cap) is read by
///      the {TradeComplianceEngine} to gate shipments.
contract ExportLicenseRegistry is ProofChainAccess, IExportLicenseRegistry {
    mapping(bytes32 => License) private _licenses;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial COMPLIANCE_OFFICER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.COMPLIANCE_OFFICER_ROLE, admin);
    }

    /// @inheritdoc IExportLicenseRegistry
    function grant(
        bytes32 licenseId,
        address exporter,
        bytes32 commodityCode,
        bytes32 destinationCountry,
        uint256 quantityCap,
        uint64 expiry
    ) external onlyRole(Roles.COMPLIANCE_OFFICER_ROLE) {
        _requireNotGloballyPaused();
        if (_licenses[licenseId].issuedAt != 0) revert LicenseExists(licenseId);
        if (exporter == address(0)) revert ZeroAddress();
        if (quantityCap == 0) revert ZeroQuantity();
        if (expiry <= block.timestamp) revert PastExpiry(expiry);

        _licenses[licenseId] = License({
            licenseId: licenseId,
            exporter: exporter,
            commodityCode: commodityCode,
            destinationCountry: destinationCountry,
            quantityCap: quantityCap,
            quantityUsed: 0,
            authority: msg.sender,
            issuedAt: uint64(block.timestamp),
            expiry: expiry,
            state: LicenseState.Active
        });

        emit Granted(licenseId, exporter, commodityCode, destinationCountry, quantityCap, expiry);
    }

    /// @inheritdoc IExportLicenseRegistry
    function draw(bytes32 licenseId, uint256 quantity) external onlyRole(Roles.COMPLIANCE_OFFICER_ROLE) {
        _requireNotGloballyPaused();
        License storage license = _licenses[licenseId];
        if (license.issuedAt == 0) revert UnknownLicense(licenseId);
        if (license.state != LicenseState.Active) {
            revert InvalidState(licenseId, LicenseState.Active, license.state);
        }
        if (license.expiry <= block.timestamp) revert PastExpiry(license.expiry);
        if (quantity == 0) revert ZeroQuantity();

        uint256 remaining = license.quantityCap - license.quantityUsed;
        if (quantity > remaining) revert CapExceeded(quantity, remaining);

        uint256 used = license.quantityUsed + quantity;
        license.quantityUsed = used;
        if (used == license.quantityCap) license.state = LicenseState.Exhausted;

        emit Drawn(licenseId, quantity, used);
    }

    /// @inheritdoc IExportLicenseRegistry
    function suspend(bytes32 licenseId, string calldata reason) external {
        _requireNotGloballyPaused();
        License storage license = _requireAuthority(licenseId);
        if (license.state != LicenseState.Active) {
            revert InvalidState(licenseId, LicenseState.Active, license.state);
        }

        license.state = LicenseState.Suspended;
        emit Suspended(licenseId, reason);
    }

    /// @inheritdoc IExportLicenseRegistry
    function reinstate(bytes32 licenseId) external {
        _requireNotGloballyPaused();
        License storage license = _requireAuthority(licenseId);
        if (license.state != LicenseState.Suspended) {
            revert InvalidState(licenseId, LicenseState.Suspended, license.state);
        }

        // Restore to Active, or Exhausted if the cap was fully drawn while suspended.
        license.state =
            license.quantityUsed >= license.quantityCap ? LicenseState.Exhausted : LicenseState.Active;
        emit Reinstated(licenseId);
    }

    /// @inheritdoc IExportLicenseRegistry
    function revoke(bytes32 licenseId, string calldata reason) external {
        _requireNotGloballyPaused();
        License storage license = _requireAuthority(licenseId);
        if (license.state == LicenseState.Revoked) {
            revert InvalidState(licenseId, LicenseState.Active, license.state);
        }

        license.state = LicenseState.Revoked;
        emit Revoked(licenseId, reason);
    }

    /// @inheritdoc IExportLicenseRegistry
    function isValid(bytes32 licenseId) external view returns (bool) {
        License storage license = _licenses[licenseId];
        return license.state == LicenseState.Active && license.expiry > block.timestamp
            && license.quantityUsed < license.quantityCap;
    }

    /// @inheritdoc IExportLicenseRegistry
    function licenseOf(bytes32 licenseId) external view returns (License memory) {
        return _licenses[licenseId];
    }

    /// @dev Load a license and require the caller to be its granting authority.
    function _requireAuthority(bytes32 licenseId) internal view returns (License storage license) {
        license = _licenses[licenseId];
        if (license.issuedAt == 0) revert UnknownLicense(licenseId);
        if (msg.sender != license.authority) revert NotAuthority(licenseId);
    }
}
