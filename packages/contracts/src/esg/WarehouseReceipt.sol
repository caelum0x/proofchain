// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IWarehouseReceipt } from "../interfaces/IWarehouseReceipt.sol";

/// @title WarehouseReceipt
/// @notice ERC721 tokenized stored-goods receipt. Each token represents a claim on a quantity
///         of goods held at a warehouse location and can be redeemed (burned) to release them.
/// @dev Receipts are sequentially numbered from 1. Redeeming burns the NFT but preserves the
///      historical {Receipt} record (marked `redeemed`) for indexing/audit.
contract WarehouseReceipt is ProofChainAccess, ERC721, IWarehouseReceipt {
    /// @dev Monotonic id counter; the next token to be minted. Starts at 1 so 0 is never valid.
    uint256 private _nextTokenId = 1;

    /// @dev tokenId => receipt record (retained after redemption for audit trails).
    mapping(uint256 => Receipt) private _receipts;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial MINTER_ROLE.
    constructor(address addressBook_, address admin)
        ProofChainAccess(addressBook_, admin)
        ERC721("ProofChain Warehouse Receipt", "PCWR")
    {
        _grantRole(Roles.MINTER_ROLE, admin);
    }

    /// @inheritdoc IWarehouseReceipt
    function issue(bytes32 batchId, address to, uint256 quantity, string calldata location)
        external
        override
        onlyRole(Roles.MINTER_ROLE)
        returns (uint256 tokenId)
    {
        _requireNotGloballyPaused();
        if (to == address(0)) revert ZeroAddress();
        if (quantity == 0) revert ZeroQuantity();

        tokenId = _nextTokenId++;
        _receipts[tokenId] = Receipt({
            tokenId: tokenId,
            batchId: batchId,
            quantity: quantity,
            location: location,
            redeemed: false
        });

        _safeMint(to, tokenId);
        emit Issued(tokenId, batchId, to, quantity, location);
    }

    /// @inheritdoc IWarehouseReceipt
    function redeem(uint256 tokenId) external override {
        _requireNotGloballyPaused();

        Receipt storage receipt = _receipts[tokenId];
        if (receipt.redeemed) revert AlreadyRedeemed(tokenId);
        // Reverts NotReceiptOwner for both wrong-caller and never-issued token ids.
        if (_ownerOf(tokenId) != msg.sender) revert NotReceiptOwner(tokenId);

        receipt.redeemed = true;
        _burn(tokenId);
        emit Redeemed(tokenId, msg.sender);
    }

    /// @inheritdoc IWarehouseReceipt
    function receiptOf(uint256 tokenId) external view override returns (Receipt memory) {
        return _receipts[tokenId];
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
