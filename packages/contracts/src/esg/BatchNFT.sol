// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IBatchNFT } from "../interfaces/IBatchNFT.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title BatchNFT
/// @notice ERC721 tokenized bill of lading. One title NFT per registered provenance batch,
///         with `tokenId == uint256(batchId)` so title and ground-truth share a key.
/// @dev Resolves the {ProvenanceRegistry} through the {AddressBook} (never hardcoded). Only
///      holders of {Roles.MINTER_ROLE} can mint, and only for batches that already exist in the
///      registry — this keeps title issuance anchored to real, registered shipments.
contract BatchNFT is ProofChainAccess, ERC721, IBatchNFT {
    /// @param addressBook_ Deployed {AddressBook} used to resolve the ProvenanceRegistry.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial MINTER_ROLE.
    constructor(address addressBook_, address admin)
        ProofChainAccess(addressBook_, admin)
        ERC721("ProofChain Batch Title", "PCBT")
    {
        _grantRole(Roles.MINTER_ROLE, admin);
    }

    /// @inheritdoc IBatchNFT
    function mint(bytes32 batchId, address to)
        external
        override
        onlyRole(Roles.MINTER_ROLE)
        returns (uint256 tokenId)
    {
        _requireNotGloballyPaused();
        if (to == address(0)) revert ZeroAddress();

        // Title can only be issued for a batch that exists in the ground-truth registry.
        IProvenanceRegistry registry = IProvenanceRegistry(_addr(Keys.PROVENANCE_REGISTRY));
        if (!registry.batchExists(batchId)) revert UnknownBatch(batchId);

        tokenId = uint256(batchId);
        if (_ownerOf(tokenId) != address(0)) revert AlreadyMinted(tokenId);

        _safeMint(to, tokenId);
        emit BatchMinted(batchId, tokenId, to);
    }

    /// @inheritdoc IBatchNFT
    /// @dev The metadata URI is the batch's canonical provenance metadata, so title and
    ///      shipment documentation never drift apart.
    function tokenURI(uint256 tokenId) public view override(ERC721, IBatchNFT) returns (string memory) {
        _requireOwned(tokenId);
        IProvenanceRegistry registry = IProvenanceRegistry(_addr(Keys.PROVENANCE_REGISTRY));
        return registry.getBatch(bytes32(tokenId)).metadataURI;
    }

    /// @dev Resolve the ERC165/AccessControl multiple-inheritance ambiguity.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl, IERC165)
        returns (bool)
    {
        return ERC721.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }
}
