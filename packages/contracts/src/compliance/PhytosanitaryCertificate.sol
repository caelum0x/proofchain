// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IPhytosanitaryCertificate } from "../interfaces/IPhytosanitaryCertificate.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title PhytosanitaryCertificate
/// @notice Plant-health certificates for agricultural consignments, attesting freedom from regulated
///         pests and any required treatment (fumigation/heat/cold/irradiation/chemical). Customs and
///         cold-chain modules read `isValid` for perishable/plant goods.
/// @dev Peers resolved via the {AddressBook}. When {ProvenanceRegistry} is wired the referenced batch
///      must exist. Only CERTIFIER_ROLE issues; certificates can be revoked on border interception.
contract PhytosanitaryCertificate is ProofChainAccess, IPhytosanitaryCertificate {
    mapping(bytes32 => Certificate) private _certs;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial CERTIFIER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.CERTIFIER_ROLE, admin);
    }

    /// @inheritdoc IPhytosanitaryCertificate
    function issue(
        bytes32 certId,
        bytes32 batchId,
        bytes32 originCountry,
        bytes32 destinationCountry,
        bytes32 botanicalName,
        TreatmentType treatment,
        bytes32 documentHash,
        uint64 expiry
    ) external onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        if (_certs[certId].issuedAt != 0) revert CertExists(certId);
        if (expiry <= block.timestamp) revert PastExpiry(expiry);
        _requireBatch(batchId);

        _certs[certId] = Certificate({
            certId: certId,
            batchId: batchId,
            originCountry: originCountry,
            destinationCountry: destinationCountry,
            botanicalName: botanicalName,
            treatment: treatment,
            issuer: msg.sender,
            documentHash: documentHash,
            issuedAt: uint64(block.timestamp),
            expiry: expiry,
            revoked: false
        });

        emit Issued(certId, batchId, originCountry, destinationCountry, treatment, expiry);
    }

    /// @inheritdoc IPhytosanitaryCertificate
    function revoke(bytes32 certId, string calldata reason) external onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        Certificate storage cert = _certs[certId];
        if (cert.issuedAt == 0) revert UnknownCert(certId);
        if (cert.revoked) revert AlreadyRevoked(certId);

        cert.revoked = true;
        emit Revoked(certId, reason);
    }

    /// @inheritdoc IPhytosanitaryCertificate
    function isValid(bytes32 certId) external view returns (bool) {
        Certificate storage cert = _certs[certId];
        return cert.issuedAt != 0 && !cert.revoked && cert.expiry > block.timestamp;
    }

    /// @inheritdoc IPhytosanitaryCertificate
    function certificateOf(bytes32 certId) external view returns (Certificate memory) {
        return _certs[certId];
    }

    /// @dev Require the batch to exist in provenance ground-truth when that peer is wired.
    function _requireBatch(bytes32 batchId) internal view {
        address prov = _addrOrZero(Keys.PROVENANCE_REGISTRY);
        if (prov != address(0) && !IProvenanceRegistry(prov).batchExists(batchId)) {
            revert IProvenanceRegistry.UnknownBatch(batchId);
        }
    }
}
