// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IWorkerCredential } from "../interfaces/IWorkerCredential.sol";

/// @title WorkerCredential
/// @notice Soulbound (non-transferable) ERC721 identity credential for a worker. Each token binds a worker
///         wallet to an off-chain identity commitment, an issuing employer/body and a role; it anchors the
///         worker's safety-training, skill and labor-compliance records. Transfers revert; issuers can
///         suspend/reactivate/revoke on separation or fraud, and renew the expiry of active credentials.
/// @dev Peers are resolved via the {AddressBook} (this contract is a source of truth other workforce
///      modules read from). Minting/lifecycle are gated to {Roles.CERTIFIER_ROLE}. Exactly one credential
///      may exist per worker wallet. Implements {IWorkerCredential}; soulbound enforcement lives in
///      {_update}, which permits mints (from == 0) but reverts any wallet-to-wallet transfer.
contract WorkerCredential is ERC721, ProofChainAccess, IWorkerCredential {
    using Strings for uint256;

    /// @notice Prefix for the token metadata URI (token id appended as 0x-hex).
    string public constant URI_PREFIX = "proofchain://worker-credential/";

    /// @dev tokenId => credential record. Token ids start at 1 so that 0 encodes "no credential".
    mapping(uint256 => Credential) private _credentials;
    /// @dev worker wallet => credential token id (0 == none).
    mapping(address => uint256) private _workerToken;
    /// @dev Monotonic token id counter; first minted id is 1.
    uint256 private _nextId;

    /// @notice A credential expiry must be strictly in the future (and, on renew, beyond the current one).
    error InvalidExpiry(uint64 expiresAt);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial CERTIFIER_ROLE.
    constructor(address addressBook_, address admin)
        ERC721("ProofChain Worker Credential", "PCWC")
        ProofChainAccess(addressBook_, admin)
    {
        _grantRole(Roles.CERTIFIER_ROLE, admin);
    }

    /// @inheritdoc IWorkerCredential
    function issue(address worker, bytes32 identityCommit, bytes32 role, uint64 expiresAt)
        external
        override
        onlyRole(Roles.CERTIFIER_ROLE)
        returns (uint256 tokenId)
    {
        _requireNotGloballyPaused();
        if (worker == address(0)) revert ZeroWorker();
        if (_workerToken[worker] != 0) revert WorkerCredentialExists(worker);
        if (expiresAt <= block.timestamp) revert InvalidExpiry(expiresAt);

        tokenId = ++_nextId;
        _credentials[tokenId] = Credential({
            tokenId: tokenId,
            worker: worker,
            issuer: msg.sender,
            identityCommit: identityCommit,
            role: role,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            status: CredentialStatus.Active
        });
        _workerToken[worker] = tokenId;

        _safeMint(worker, tokenId);
        emit CredentialIssued(tokenId, worker, msg.sender, role);
    }

    /// @inheritdoc IWorkerCredential
    function setStatus(uint256 tokenId, CredentialStatus status) external override {
        _requireNotGloballyPaused();
        Credential storage cred = _requireCredential(tokenId);
        _requireIssuerOrCertifier(cred, tokenId);

        CredentialStatus from = cred.status;
        if (!_isValidTransition(from, status)) {
            revert InvalidStatusTransition(tokenId, from, status);
        }

        cred.status = status;
        emit CredentialStatusChanged(tokenId, status);
    }

    /// @inheritdoc IWorkerCredential
    function renew(uint256 tokenId, uint64 expiresAt) external override {
        _requireNotGloballyPaused();
        Credential storage cred = _requireCredential(tokenId);
        _requireIssuerOrCertifier(cred, tokenId);
        if (cred.status == CredentialStatus.Revoked) {
            revert InvalidStatusTransition(tokenId, CredentialStatus.Revoked, CredentialStatus.Active);
        }
        if (expiresAt <= block.timestamp || expiresAt <= cred.expiresAt) {
            revert InvalidExpiry(expiresAt);
        }

        cred.expiresAt = expiresAt;
        emit CredentialRenewed(tokenId, expiresAt);
    }

    /// @inheritdoc IWorkerCredential
    function isActive(address worker) external view override returns (bool) {
        uint256 tokenId = _workerToken[worker];
        if (tokenId == 0) return false;
        Credential storage cred = _credentials[tokenId];
        return cred.status == CredentialStatus.Active && cred.expiresAt > block.timestamp;
    }

    /// @inheritdoc IWorkerCredential
    function credentialOfWorker(address worker) external view override returns (uint256) {
        return _workerToken[worker];
    }

    /// @inheritdoc IWorkerCredential
    function credentialOf(uint256 tokenId) external view override returns (Credential memory) {
        return _credentials[tokenId];
    }

    /// @inheritdoc ERC721
    /// @dev Reverts for non-existent tokens; encodes the token id so indexers can resolve the credential.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(URI_PREFIX, tokenId.toHexString(32));
    }

    /// @dev Resolve the ERC165 diamond between {ERC721} and {AccessControl}.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl, IERC165)
        returns (bool)
    {
        return ERC721.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }

    /// @dev Soulbound enforcement: allow mints (from == 0) but revert any transfer between wallets.
    ///      Burns (to == 0) are not exposed by this contract, so only mint paths pass through.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    /// @dev Fetch a credential by token id or revert {UnknownCredential}.
    function _requireCredential(uint256 tokenId) private view returns (Credential storage cred) {
        cred = _credentials[tokenId];
        if (cred.worker == address(0)) revert UnknownCredential(tokenId);
    }

    /// @dev Only the issuing party or a CERTIFIER may mutate a credential's lifecycle.
    function _requireIssuerOrCertifier(Credential storage cred, uint256 tokenId) private view {
        if (msg.sender != cred.issuer && !hasRole(Roles.CERTIFIER_ROLE, msg.sender)) {
            revert NotIssuer(tokenId);
        }
    }

    /// @dev Legal status transitions: Active<->Suspended, Active/Suspended->Revoked. Revoked is terminal
    ///      and `None` is never a valid target.
    function _isValidTransition(CredentialStatus from, CredentialStatus to) private pure returns (bool) {
        if (to == CredentialStatus.Active) return from == CredentialStatus.Suspended;
        if (to == CredentialStatus.Suspended) return from == CredentialStatus.Active;
        if (to == CredentialStatus.Revoked) {
            return from == CredentialStatus.Active || from == CredentialStatus.Suspended;
        }
        return false;
    }
}
