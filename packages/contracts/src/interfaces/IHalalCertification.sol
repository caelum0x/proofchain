// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IHalalCertification
/// @notice Halal certification issued by accredited certification bodies for food/cosmetic/pharma batches,
///         attesting compliance with a named standard (e.g. MS1500, GSO 2055). Certificates carry a
///         validity window, may be suspended/revoked, and are checked by marketplace/compliance modules.
/// @dev deps (AddressBook): ProvenanceRegistry, OrganizationRegistry.
interface IHalalCertification {
    enum CertStatus {
        None,
        Active,
        Suspended,
        Revoked,
        Expired
    }

    struct Certificate {
        bytes32 certId;
        bytes32 batchId;
        bytes32 standard;
        address certifier;
        address producer;
        bytes32 documentHash;
        uint64 issuedAt;
        uint64 expiry;
        CertStatus status;
    }

    event Issued(bytes32 indexed certId, bytes32 indexed batchId, bytes32 standard, address indexed certifier, uint64 expiry);
    event Suspended(bytes32 indexed certId, string reason);
    event Reinstated(bytes32 indexed certId);
    event Revoked(bytes32 indexed certId, string reason);

    error CertExists(bytes32 certId);
    error UnknownCert(bytes32 certId);
    error InvalidStatus(bytes32 certId, CertStatus expected, CertStatus actual);
    error PastExpiry(uint64 expiry);

    /// @notice Issue a halal certificate. CERTIFIER_ROLE only.
    function issue(bytes32 certId, bytes32 batchId, bytes32 standard, address producer, bytes32 documentHash, uint64 expiry)
        external;

    /// @notice Suspend an active certificate pending re-audit.
    function suspend(bytes32 certId, string calldata reason) external;

    /// @notice Reinstate a suspended certificate.
    function reinstate(bytes32 certId) external;

    /// @notice Permanently revoke a certificate.
    function revoke(bytes32 certId, string calldata reason) external;

    /// @notice True if the certificate is Active and not expired.
    function isValid(bytes32 certId) external view returns (bool);

    function certificateOf(bytes32 certId) external view returns (Certificate memory);
}
