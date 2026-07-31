// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IHalalCertification } from "../interfaces/IHalalCertification.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title HalalCertification
/// @notice Halal certification for food/cosmetic/pharma batches against a named standard (e.g. MS1500,
///         GSO 2055). Certificates carry a validity window and a lifecycle (Active -> Suspended ->
///         Active, or -> Revoked). Marketplace/compliance modules read `isValid`.
/// @dev Peers resolved via the {AddressBook}. When {ProvenanceRegistry} is wired the referenced batch
///      must exist. Only CERTIFIER_ROLE manages certificates.
contract HalalCertification is ProofChainAccess, IHalalCertification {
    mapping(bytes32 => Certificate) private _certs;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial CERTIFIER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.CERTIFIER_ROLE, admin);
    }

    /// @inheritdoc IHalalCertification
    function issue(
        bytes32 certId,
        bytes32 batchId,
        bytes32 standard,
        address producer,
        bytes32 documentHash,
        uint64 expiry
    ) external onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        if (_certs[certId].issuedAt != 0) revert CertExists(certId);
        if (producer == address(0)) revert ZeroAddress();
        if (expiry <= block.timestamp) revert PastExpiry(expiry);
        _requireBatch(batchId);

        _certs[certId] = Certificate({
            certId: certId,
            batchId: batchId,
            standard: standard,
            certifier: msg.sender,
            producer: producer,
            documentHash: documentHash,
            issuedAt: uint64(block.timestamp),
            expiry: expiry,
            status: CertStatus.Active
        });

        emit Issued(certId, batchId, standard, msg.sender, expiry);
    }

    /// @inheritdoc IHalalCertification
    function suspend(bytes32 certId, string calldata reason) external onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        Certificate storage cert = _certs[certId];
        _requireStatus(certId, cert, CertStatus.Active);

        cert.status = CertStatus.Suspended;
        emit Suspended(certId, reason);
    }

    /// @inheritdoc IHalalCertification
    function reinstate(bytes32 certId) external onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        Certificate storage cert = _certs[certId];
        _requireStatus(certId, cert, CertStatus.Suspended);

        cert.status = CertStatus.Active;
        emit Reinstated(certId);
    }

    /// @inheritdoc IHalalCertification
    function revoke(bytes32 certId, string calldata reason) external onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        Certificate storage cert = _certs[certId];
        if (cert.issuedAt == 0) revert UnknownCert(certId);
        // Revocable only from an Active or Suspended state.
        if (cert.status != CertStatus.Active && cert.status != CertStatus.Suspended) {
            revert InvalidStatus(certId, CertStatus.Active, cert.status);
        }

        cert.status = CertStatus.Revoked;
        emit Revoked(certId, reason);
    }

    /// @inheritdoc IHalalCertification
    function isValid(bytes32 certId) external view returns (bool) {
        Certificate storage cert = _certs[certId];
        return cert.status == CertStatus.Active && cert.expiry > block.timestamp;
    }

    /// @inheritdoc IHalalCertification
    function certificateOf(bytes32 certId) external view returns (Certificate memory) {
        return _certs[certId];
    }

    /// @dev Revert if the certificate is unknown or not in the `expected` status.
    function _requireStatus(bytes32 certId, Certificate storage cert, CertStatus expected) internal view {
        if (cert.issuedAt == 0) revert UnknownCert(certId);
        if (cert.status != expected) revert InvalidStatus(certId, expected, cert.status);
    }

    /// @dev Require the batch to exist in provenance ground-truth when that peer is wired.
    function _requireBatch(bytes32 batchId) internal view {
        address prov = _addrOrZero(Keys.PROVENANCE_REGISTRY);
        if (prov != address(0) && !IProvenanceRegistry(prov).batchExists(batchId)) {
            revert IProvenanceRegistry.UnknownBatch(batchId);
        }
    }
}
