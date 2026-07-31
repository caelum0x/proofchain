// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ITradeComplianceEngine } from "../interfaces/ITradeComplianceEngine.sol";
import { ISanctionsScreening } from "../interfaces/ISanctionsScreening.sol";
import { IAMLRegistry } from "../interfaces/IAMLRegistry.sol";
import { IExportLicenseRegistry } from "../interfaces/IExportLicenseRegistry.sol";
import { ICertificateOfOrigin } from "../interfaces/ICertificateOfOrigin.sol";
import { ICustomsDeclaration } from "../interfaces/ICustomsDeclaration.sol";

/// @title TradeComplianceEngine
/// @notice Aggregates sanctions, AML, export-license, certificate-of-origin and customs signals into a
///         single deterministic clearance decision that finance/logistics modules gate on. Per-destination
///         requirements decide which checks are mandatory; any failed mandatory check blocks the shipment.
/// @dev Peers resolved via the {AddressBook}. Batch-scoped license/declaration bindings (set by a
///      compliance officer) let the fixed `evaluate` signature resolve the right license/customs records.
contract TradeComplianceEngine is ProofChainAccess, ITradeComplianceEngine {
    /// @dev `failedFlags` / `requiredFlags` bit positions.
    uint32 internal constant FLAG_SANCTIONS = 1 << 0;
    uint32 internal constant FLAG_AML = 1 << 1;
    uint32 internal constant FLAG_LICENSE = 1 << 2;
    uint32 internal constant FLAG_CERTIFICATE = 1 << 3;
    uint32 internal constant FLAG_CUSTOMS = 1 << 4;

    mapping(bytes32 => uint32) private _requirements; // destinationCountry => requiredFlags
    mapping(bytes32 => Check) private _checks; // batchId => Check
    mapping(bytes32 => bytes32) private _batchLicense; // batchId => licenseId
    mapping(bytes32 => bytes32) private _batchDeclaration; // batchId => declarationId

    /// @notice A license id was bound to a batch for the LICENSE check.
    event LicenseBound(bytes32 indexed batchId, bytes32 indexed licenseId);
    /// @notice A customs declaration id was bound to a batch for the CUSTOMS check.
    event DeclarationBound(bytes32 indexed batchId, bytes32 indexed declarationId);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial COMPLIANCE_OFFICER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.COMPLIANCE_OFFICER_ROLE, admin);
    }

    /// @inheritdoc ITradeComplianceEngine
    function setRequirements(bytes32 destinationCountry, uint32 requiredFlags)
        external
        onlyRole(Roles.COMPLIANCE_OFFICER_ROLE)
    {
        _requireNotGloballyPaused();
        if (destinationCountry == bytes32(0)) revert ZeroCountry();

        _requirements[destinationCountry] = requiredFlags;
        emit RequirementSet(destinationCountry, requiredFlags);
    }

    /// @notice Bind the export license id that satisfies the LICENSE check for a batch.
    function bindLicense(bytes32 batchId, bytes32 licenseId) external onlyRole(Roles.COMPLIANCE_OFFICER_ROLE) {
        _requireNotGloballyPaused();
        _batchLicense[batchId] = licenseId;
        emit LicenseBound(batchId, licenseId);
    }

    /// @notice Bind the customs declaration id that satisfies the CUSTOMS check for a batch.
    function bindDeclaration(bytes32 batchId, bytes32 declarationId)
        external
        onlyRole(Roles.COMPLIANCE_OFFICER_ROLE)
    {
        _requireNotGloballyPaused();
        _batchDeclaration[batchId] = declarationId;
        emit DeclarationBound(batchId, declarationId);
    }

    /// @inheritdoc ITradeComplianceEngine
    function evaluate(bytes32 batchId, address exporter, address importer, bytes32 destinationCountry)
        external
        returns (Decision decision)
    {
        _requireNotGloballyPaused();

        uint32 required = _requirements[destinationCountry];
        uint32 failed = _computeFailed(batchId, exporter, importer, destinationCountry, required);

        decision = failed == 0 ? Decision.Cleared : Decision.Blocked;

        _checks[batchId] = Check({
            batchId: batchId,
            exporter: exporter,
            importer: importer,
            destinationCountry: destinationCountry,
            decision: decision,
            failedFlags: failed,
            evaluatedAt: uint64(block.timestamp)
        });

        emit Evaluated(batchId, decision, failed);
    }

    /// @inheritdoc ITradeComplianceEngine
    function override_(bytes32 batchId, Decision decision, string calldata reason)
        external
        onlyRole(Roles.COMPLIANCE_OFFICER_ROLE)
    {
        _requireNotGloballyPaused();
        Check storage check = _checks[batchId];
        if (check.evaluatedAt == 0) revert UnknownCheck(batchId);

        check.decision = decision;
        check.evaluatedAt = uint64(block.timestamp);
        emit Overridden(batchId, decision, reason);
    }

    /// @inheritdoc ITradeComplianceEngine
    function isCleared(bytes32 batchId) external view returns (bool) {
        return _checks[batchId].decision == Decision.Cleared;
    }

    /// @inheritdoc ITradeComplianceEngine
    function checkOf(bytes32 batchId) external view returns (Check memory) {
        return _checks[batchId];
    }

    /// @notice Configured required-flags bitmask for a destination country.
    function requirementsOf(bytes32 destinationCountry) external view returns (uint32) {
        return _requirements[destinationCountry];
    }

    // --------------------------------------------------------------------- internal

    /// @dev Run each mandatory check and accumulate the failed-flag bitmask. A check whose peer is not
    ///      wired, or whose backing record is invalid/missing, counts as failed (fail-closed).
    function _computeFailed(
        bytes32 batchId,
        address exporter,
        address importer,
        bytes32 destinationCountry,
        uint32 required
    ) internal view returns (uint32 failed) {
        if (required & FLAG_SANCTIONS != 0 && !_passSanctions(exporter, importer)) failed |= FLAG_SANCTIONS;
        if (required & FLAG_AML != 0 && !_passAml(exporter, importer)) failed |= FLAG_AML;
        if (required & FLAG_LICENSE != 0 && !_passLicense(batchId, exporter, destinationCountry)) {
            failed |= FLAG_LICENSE;
        }
        if (required & FLAG_CERTIFICATE != 0 && !_passCertificate(batchId)) failed |= FLAG_CERTIFICATE;
        if (required & FLAG_CUSTOMS != 0 && !_passCustoms(batchId)) failed |= FLAG_CUSTOMS;
    }

    function _passSanctions(address exporter, address importer) internal view returns (bool) {
        address addr = _addrOrZero(Keys.SANCTIONS_SCREENING);
        if (addr == address(0)) return false;
        ISanctionsScreening s = ISanctionsScreening(addr);
        return !s.isSanctioned(exporter) && !s.isSanctioned(importer);
    }

    function _passAml(address exporter, address importer) internal view returns (bool) {
        address addr = _addrOrZero(Keys.AML_REGISTRY);
        if (addr == address(0)) return false;
        IAMLRegistry a = IAMLRegistry(addr);
        return !a.isHighRisk(exporter) && !a.isHighRisk(importer);
    }

    function _passLicense(bytes32 batchId, address exporter, bytes32 destinationCountry)
        internal
        view
        returns (bool)
    {
        address addr = _addrOrZero(Keys.EXPORT_LICENSE_REGISTRY);
        if (addr == address(0)) return false;
        bytes32 licenseId = _batchLicense[batchId];
        if (licenseId == bytes32(0)) return false;

        IExportLicenseRegistry reg = IExportLicenseRegistry(addr);
        if (!reg.isValid(licenseId)) return false;
        IExportLicenseRegistry.License memory lic = reg.licenseOf(licenseId);
        return lic.exporter == exporter && lic.destinationCountry == destinationCountry;
    }

    function _passCertificate(bytes32 batchId) internal view returns (bool) {
        address addr = _addrOrZero(Keys.CERTIFICATE_OF_ORIGIN);
        if (addr == address(0)) return false;
        return ICertificateOfOrigin(addr).originOf(batchId) != bytes32(0);
    }

    function _passCustoms(bytes32 batchId) internal view returns (bool) {
        address addr = _addrOrZero(Keys.CUSTOMS_DECLARATION);
        if (addr == address(0)) return false;
        bytes32 declarationId = _batchDeclaration[batchId];
        if (declarationId == bytes32(0)) return false;
        return ICustomsDeclaration(addr).isReleased(declarationId);
    }
}
