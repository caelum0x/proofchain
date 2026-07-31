// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title IWarehouseReceipt
/// @notice ERC721 tokenized stored-goods receipt carrying quantity and location.
interface IWarehouseReceipt is IERC721 {
    struct Receipt {
        uint256 tokenId;
        bytes32 batchId;
        uint256 quantity;
        string location;
        bool redeemed;
    }

    event Issued(uint256 indexed tokenId, bytes32 indexed batchId, address indexed to, uint256 quantity, string location);
    event Redeemed(uint256 indexed tokenId, address indexed by);

    error ZeroQuantity();
    error AlreadyRedeemed(uint256 tokenId);
    error NotReceiptOwner(uint256 tokenId);

    /// @notice Issue a warehouse receipt NFT. MINTER_ROLE only.
    /// @return tokenId Minted receipt id.
    function issue(bytes32 batchId, address to, uint256 quantity, string calldata location)
        external
        returns (uint256 tokenId);

    /// @notice Redeem (burn) a receipt, releasing the stored goods claim.
    function redeem(uint256 tokenId) external;

    function receiptOf(uint256 tokenId) external view returns (Receipt memory);
}
