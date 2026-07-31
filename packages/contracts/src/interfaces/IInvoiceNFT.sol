// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title IInvoiceNFT
/// @notice ERC721 receivable minted per funded+attested deal; tokenId == uint256(batchId).
/// @dev deps (AddressBook): ProvenanceRegistry, AttestationRegistry.
interface IInvoiceNFT is IERC721 {
    event ReceivableMinted(bytes32 indexed batchId, uint256 indexed tokenId, address indexed to);

    error NotAttested(bytes32 batchId);
    error NotFundedOrAttested(bytes32 batchId);
    error AlreadyMinted(uint256 tokenId);
    error ZeroAddress();

    /// @notice Mint the receivable NFT for a funded+attested batch. MINTER_ROLE only.
    /// @return tokenId The minted token id (== uint256(batchId)).
    function mintReceivable(bytes32 batchId, address to) external returns (uint256 tokenId);

    function tokenURI(uint256 tokenId) external view returns (string memory);
    function batchIdOf(uint256 tokenId) external pure returns (bytes32);
}
