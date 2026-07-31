// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICertificateOfOrigin
/// @notice Accredited chambers/authorities issue Certificates of Origin attesting the country of
///         manufacture for a batch (preferential or non-preferential). Certificates can be revoked and
///         are queried by downstream customs/duty modules.
/// @dev deps (AddressBook): ProvenanceRegistry.
interface ICertificateOfOrigin {
    enum OriginType {
        NonPreferential,
        Preferential
    }

    struct Certificate {
        bytes32 certId;
        bytes32 batchId;
        bytes32 originCountry;
        OriginType originType;
        address issuer;
        address exporter;
        bytes32 documentHash;
        uint64 issuedAt;
        uint64 expiry;
        bool revoked;
    }

    event Issued(
        bytes32 indexed certId,
        bytes32 indexed batchId,
        bytes32 indexed originCountry,
        OriginType originType,
        address issuer,
        uint64 expiry
    );
    event Revoked(bytes32 indexed certId, string reason);

    error CertExists(bytes32 certId);
    error UnknownCert(bytes32 certId);
    error AlreadyRevoked(bytes32 certId);
    error ZeroCountry();
    error PastExpiry(uint64 expiry);

    /// @notice Issue a certificate of origin for a batch. CERTIFIER_ROLE only.
    function issue(
        bytes32 certId,
        bytes32 batchId,
        bytes32 originCountry,
        OriginType originType,
        address exporter,
        bytes32 documentHash,
        uint64 expiry
    ) external;

    /// @notice Revoke a previously issued certificate.
    function revoke(bytes32 certId, string calldata reason) external;

    /// @notice True if a valid, non-revoked, non-expired certificate exists for the batch.
    function isValid(bytes32 certId) external view returns (bool);

    /// @notice Origin country recorded for a batch's certificate (bytes32(0) if none/invalid).
    function originOf(bytes32 batchId) external view returns (bytes32);

    function certificateOf(bytes32 certId) external view returns (Certificate memory);
}
