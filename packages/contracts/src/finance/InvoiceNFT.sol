// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IAttestationRegistry } from "../interfaces/IAttestationRegistry.sol";
import { ISettlementEscrow } from "../interfaces/ISettlementEscrow.sol";

/// @title InvoiceNFT
/// @notice ERC721 receivable token minted per funded + attested deal; `tokenId == uint256(batchId)`.
/// @dev Implements the {IInvoiceNFT} surface. It is NOT declared `is IInvoiceNFT` because that
///      interface redeclares `ZeroAddress`, which already lives on {ProofChainAccess}; Solidity
///      forbids the duplicate declaration. Peers still import {IInvoiceNFT} to call this contract —
///      the external ABI is identical. Resolves {AttestationRegistry} and {SettlementEscrow} via
///      the {AddressBook}; minting is gated to {Roles.MINTER_ROLE} and only once a deal is both
///      escrow-funded and AI-attested.
contract InvoiceNFT is ERC721, ProofChainAccess {
    using Strings for uint256;

    /// @notice Prefix for the token metadata URI (batch id appended as 0x-hex).
    string public constant URI_PREFIX = "proofchain://receivable/";

    /// @notice Emitted when a receivable NFT is minted for a batch.
    event ReceivableMinted(bytes32 indexed batchId, uint256 indexed tokenId, address indexed to);

    error NotAttested(bytes32 batchId);
    error NotFundedOrAttested(bytes32 batchId);
    error AlreadyMinted(uint256 tokenId);

    constructor(address addressBook_, address admin)
        ERC721("ProofChain Receivable", "PCR")
        ProofChainAccess(addressBook_, admin)
    { }

    /// @notice Mint the receivable NFT for a funded + attested batch. MINTER_ROLE only.
    /// @return tokenId The minted token id (== uint256(batchId)).
    function mintReceivable(bytes32 batchId, address to)
        external
        onlyRole(Roles.MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert ZeroAddress();

        tokenId = uint256(batchId);
        if (_ownerOf(tokenId) != address(0)) revert AlreadyMinted(tokenId);

        // Must be AI-attested.
        IAttestationRegistry attestations = IAttestationRegistry(_addr(Keys.ATTESTATION_REGISTRY));
        if (!attestations.isAttested(batchId)) revert NotAttested(batchId);

        // Must correspond to a real escrow deal (funded or beyond).
        ISettlementEscrow escrow = ISettlementEscrow(_addr(Keys.SETTLEMENT_ESCROW));
        if (escrow.getDeal(batchId).state == ISettlementEscrow.DealState.None) {
            revert NotFundedOrAttested(batchId);
        }

        _safeMint(to, tokenId);
        emit ReceivableMinted(batchId, tokenId, to);
    }

    /// @notice The batch id backing a token id (they are bijective).
    function batchIdOf(uint256 tokenId) external pure returns (bytes32) {
        return bytes32(tokenId);
    }

    /// @inheritdoc ERC721
    /// @dev Reverts for non-existent tokens (via {_requireOwned}); returns a deterministic URI that
    ///      encodes the batch id so off-chain indexers can resolve the underlying receivable.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(URI_PREFIX, tokenId.toHexString(32));
    }

    /// @dev Resolve the ERC165 diamond between {ERC721} and {AccessControl}.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return ERC721.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }
}
