// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title IWorkerCredential
/// @notice Soulbound (non-transferable) ERC721 identity credential for a worker. Each token binds a worker
///         wallet to an off-chain identity commitment and employer; it anchors safety training, skills and
///         labor-compliance records. Transfers revert; issuers may revoke on separation or fraud.
/// @dev deps (AddressBook): IdentityResolver, SafetyTrainingRegistry, SkillAttestation, LaborComplianceRegistry.
interface IWorkerCredential is IERC721 {
    enum CredentialStatus {
        None,
        Active,
        Suspended,
        Revoked
    }

    struct Credential {
        uint256 tokenId;
        address worker;
        address issuer;
        bytes32 identityCommit;
        bytes32 role;
        uint64 issuedAt;
        uint64 expiresAt;
        CredentialStatus status;
    }

    event CredentialIssued(uint256 indexed tokenId, address indexed worker, address indexed issuer, bytes32 role);
    event CredentialStatusChanged(uint256 indexed tokenId, CredentialStatus status);
    event CredentialRenewed(uint256 indexed tokenId, uint64 expiresAt);

    error Soulbound();
    error ZeroWorker();
    error WorkerCredentialExists(address worker);
    error UnknownCredential(uint256 tokenId);
    error NotIssuer(uint256 tokenId);
    error InvalidStatusTransition(uint256 tokenId, CredentialStatus from, CredentialStatus to);

    /// @notice Issue a soulbound credential to a worker. CERTIFIER_ROLE only.
    function issue(address worker, bytes32 identityCommit, bytes32 role, uint64 expiresAt)
        external
        returns (uint256 tokenId);

    /// @notice Suspend/reactivate/revoke a credential. Issuing party / CERTIFIER_ROLE.
    function setStatus(uint256 tokenId, CredentialStatus status) external;

    /// @notice Extend the expiry of an active credential.
    function renew(uint256 tokenId, uint64 expiresAt) external;

    /// @notice True if the worker holds an active, unexpired credential.
    function isActive(address worker) external view returns (bool);

    /// @notice Credential token id held by a worker (0 if none).
    function credentialOfWorker(address worker) external view returns (uint256);

    function credentialOf(uint256 tokenId) external view returns (Credential memory);
}
