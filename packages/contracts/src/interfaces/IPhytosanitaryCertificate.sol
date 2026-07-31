// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IPhytosanitaryCertificate
/// @notice Plant-health certificates issued by national plant protection authorities for agricultural
///         consignments, attesting freedom from regulated pests and any required treatment (e.g.
///         fumigation). Consumed by customs and cold-chain modules for perishable/plant goods.
/// @dev deps (AddressBook): ProvenanceRegistry, HarvestRegistry.
interface IPhytosanitaryCertificate {
    enum TreatmentType {
        None,
        Fumigation,
        HeatTreatment,
        ColdTreatment,
        Irradiation,
        Chemical
    }

    struct Certificate {
        bytes32 certId;
        bytes32 batchId;
        bytes32 originCountry;
        bytes32 destinationCountry;
        bytes32 botanicalName;
        TreatmentType treatment;
        address issuer;
        bytes32 documentHash;
        uint64 issuedAt;
        uint64 expiry;
        bool revoked;
    }

    event Issued(
        bytes32 indexed certId,
        bytes32 indexed batchId,
        bytes32 originCountry,
        bytes32 destinationCountry,
        TreatmentType treatment,
        uint64 expiry
    );
    event Revoked(bytes32 indexed certId, string reason);

    error CertExists(bytes32 certId);
    error UnknownCert(bytes32 certId);
    error AlreadyRevoked(bytes32 certId);
    error PastExpiry(uint64 expiry);

    /// @notice Issue a phytosanitary certificate. CERTIFIER_ROLE only.
    function issue(
        bytes32 certId,
        bytes32 batchId,
        bytes32 originCountry,
        bytes32 destinationCountry,
        bytes32 botanicalName,
        TreatmentType treatment,
        bytes32 documentHash,
        uint64 expiry
    ) external;

    /// @notice Revoke a certificate (e.g. pest interception at border).
    function revoke(bytes32 certId, string calldata reason) external;

    /// @notice True if a valid, non-revoked, non-expired certificate covers the batch.
    function isValid(bytes32 certId) external view returns (bool);

    function certificateOf(bytes32 certId) external view returns (Certificate memory);
}
