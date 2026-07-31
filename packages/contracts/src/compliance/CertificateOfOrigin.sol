// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ICertificateOfOrigin } from "../interfaces/ICertificateOfOrigin.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title CertificateOfOrigin
/// @notice Accredited chambers/authorities issue Certificates of Origin binding a batch to a country of
///         manufacture (preferential or non-preferential). Downstream customs/duty modules read
///         `originOf(batchId)` to apply the correct tariff lane.
/// @dev Peers resolved via the {AddressBook}. When {ProvenanceRegistry} is wired the referenced batch
///      must exist, tying the certificate to real provenance ground-truth. Only CERTIFIER_ROLE issues.
contract CertificateOfOrigin is ProofChainAccess, ICertificateOfOrigin {
    mapping(bytes32 => Certificate) private _certs;
    /// @dev Latest certificate id issued for a batch, used by `originOf`.
    mapping(bytes32 => bytes32) private _batchCert;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial CERTIFIER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.CERTIFIER_ROLE, admin);
    }

    /// @inheritdoc ICertificateOfOrigin
    function issue(
        bytes32 certId,
        bytes32 batchId,
        bytes32 originCountry,
        OriginType originType,
        address exporter,
        bytes32 documentHash,
        uint64 expiry
    ) external onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        if (_certs[certId].issuedAt != 0) revert CertExists(certId);
        if (originCountry == bytes32(0)) revert ZeroCountry();
        if (exporter == address(0)) revert ZeroAddress();
        if (expiry <= block.timestamp) revert PastExpiry(expiry);
        _requireBatch(batchId);

        _certs[certId] = Certificate({
            certId: certId,
            batchId: batchId,
            originCountry: originCountry,
            originType: originType,
            issuer: msg.sender,
            exporter: exporter,
            documentHash: documentHash,
            issuedAt: uint64(block.timestamp),
            expiry: expiry,
            revoked: false
        });
        _batchCert[batchId] = certId;

        emit Issued(certId, batchId, originCountry, originType, msg.sender, expiry);
    }

    /// @inheritdoc ICertificateOfOrigin
    function revoke(bytes32 certId, string calldata reason) external onlyRole(Roles.CERTIFIER_ROLE) {
        _requireNotGloballyPaused();
        Certificate storage cert = _certs[certId];
        if (cert.issuedAt == 0) revert UnknownCert(certId);
        if (cert.revoked) revert AlreadyRevoked(certId);

        cert.revoked = true;
        emit Revoked(certId, reason);
    }

    /// @inheritdoc ICertificateOfOrigin
    function isValid(bytes32 certId) public view returns (bool) {
        Certificate storage cert = _certs[certId];
        return cert.issuedAt != 0 && !cert.revoked && cert.expiry > block.timestamp;
    }

    /// @inheritdoc ICertificateOfOrigin
    function originOf(bytes32 batchId) external view returns (bytes32) {
        bytes32 certId = _batchCert[batchId];
        if (certId == bytes32(0) || !isValid(certId)) return bytes32(0);
        return _certs[certId].originCountry;
    }

    /// @inheritdoc ICertificateOfOrigin
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
