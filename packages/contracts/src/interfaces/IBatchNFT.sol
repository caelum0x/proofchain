// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title IBatchNFT
/// @notice ERC721 tokenized bill of lading minted on batch registration; transferable title.
/// @dev tokenId == uint256(batchId). deps (AddressBook): ProvenanceRegistry.
interface IBatchNFT is IERC721 {
    event BatchMinted(bytes32 indexed batchId, uint256 indexed tokenId, address indexed to);

    error UnknownBatch(bytes32 batchId);
    error AlreadyMinted(uint256 tokenId);

    /// @notice Mint the title NFT for a registered batch. MINTER_ROLE only.
    /// @return tokenId Minted token id (== uint256(batchId)).
    function mint(bytes32 batchId, address to) external returns (uint256 tokenId);

    function tokenURI(uint256 tokenId) external view returns (string memory);
}
