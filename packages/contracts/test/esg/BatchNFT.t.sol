// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

import { Test } from "forge-std/Test.sol";

import { BatchNFT } from "../../src/esg/BatchNFT.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IBatchNFT } from "../../src/interfaces/IBatchNFT.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IERC721Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract BatchNFTTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    BatchNFT internal nft;

    address internal admin = address(0xA11CE);
    address internal minter = address(0xB0B);
    address internal alice = address(0xA71CE);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("origin");
    string internal constant META = "ipfs://batch-meta";

    event BatchMinted(bytes32 indexed batchId, uint256 indexed tokenId, address indexed to);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        nft = new BatchNFT(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerBatch(BATCH, ORIGIN, META);
        nft.grantRole(Roles.MINTER_ROLE, minter);
        vm.stopPrank();
    }

    function test_AdminRolesConfigured() public view {
        assertTrue(nft.hasRole(nft.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(nft.hasRole(Roles.MINTER_ROLE, admin));
        assertTrue(nft.hasRole(Roles.MINTER_ROLE, minter));
    }

    function test_Mint_HappyPath() public {
        uint256 expectedId = uint256(BATCH);

        vm.expectEmit(true, true, true, false, address(nft));
        emit BatchMinted(BATCH, expectedId, alice);

        vm.prank(minter);
        uint256 tokenId = nft.mint(BATCH, alice);

        assertEq(tokenId, expectedId);
        assertEq(nft.ownerOf(tokenId), alice);
        assertEq(nft.balanceOf(alice), 1);
    }

    function test_TokenURI_MirrorsProvenanceMetadata() public {
        vm.prank(minter);
        uint256 tokenId = nft.mint(BATCH, alice);
        assertEq(nft.tokenURI(tokenId), META);
    }

    function test_Title_IsTransferable() public {
        vm.prank(minter);
        uint256 tokenId = nft.mint(BATCH, alice);

        vm.prank(alice);
        nft.transferFrom(alice, stranger, tokenId);
        assertEq(nft.ownerOf(tokenId), stranger);
    }

    function test_RevertWhen_MintUnknownBatch() public {
        bytes32 ghost = keccak256("ghost");
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(IBatchNFT.UnknownBatch.selector, ghost));
        nft.mint(ghost, alice);
    }

    function test_RevertWhen_MintToZero() public {
        vm.prank(minter);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        nft.mint(BATCH, address(0));
    }

    function test_RevertWhen_MintTwice() public {
        vm.startPrank(minter);
        uint256 tokenId = nft.mint(BATCH, alice);
        vm.expectRevert(abi.encodeWithSelector(IBatchNFT.AlreadyMinted.selector, tokenId));
        nft.mint(BATCH, stranger);
        vm.stopPrank();
    }

    function test_RevertWhen_NonMinterMints() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.MINTER_ROLE)
        );
        nft.mint(BATCH, alice);
    }

    function test_RevertWhen_TokenURIForNonexistent() public {
        uint256 ghostId = uint256(keccak256("ghost"));
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, ghostId));
        nft.tokenURI(ghostId);
    }

    function test_SupportsInterface() public view {
        // ERC721 + AccessControl interface ids both resolve true.
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(nft.supportsInterface(0x7965db0b)); // AccessControl (IAccessControl)
        assertTrue(nft.supportsInterface(0x01ffc9a7)); // ERC165
    }
}
