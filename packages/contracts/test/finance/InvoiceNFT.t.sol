// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { InvoiceNFT } from "../../src/finance/InvoiceNFT.sol";
import { ISettlementEscrow } from "../../src/interfaces/ISettlementEscrow.sol";
import { MockAttestation } from "./mocks/MockAttestation.sol";
import { MockSettlementEscrow } from "./mocks/MockSettlementEscrow.sol";

contract InvoiceNFTTest is Test {
    AddressBook internal book;
    InvoiceNFT internal nft;
    MockAttestation internal att;
    MockSettlementEscrow internal escrow;

    address internal admin = address(0xA11CE);
    address internal minter = address(0x37E4);
    address internal supplier = address(0xB0B);
    address internal lender = address(0x1E4D);
    address internal token = address(0x5709);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");

    event ReceivableMinted(bytes32 indexed batchId, uint256 indexed tokenId, address indexed to);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        nft = new InvoiceNFT(address(book), admin);
        att = new MockAttestation();
        escrow = new MockSettlementEscrow();
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        book.setAddress(Keys.SETTLEMENT_ESCROW, address(escrow));
        nft.grantRole(Roles.MINTER_ROLE, minter);
        vm.stopPrank();

        // A funded + attested batch is the precondition for minting.
        escrow.setDeal(BATCH, address(0xB111), supplier, token, 1_000e6, ISettlementEscrow.DealState.Funded);
        att.setAttested(BATCH, true, 9600);
    }

    function test_Mint_Happy() public {
        uint256 expectedId = uint256(BATCH);
        vm.expectEmit(true, true, true, false);
        emit ReceivableMinted(BATCH, expectedId, supplier);

        vm.prank(minter);
        uint256 id = nft.mintReceivable(BATCH, supplier);

        assertEq(id, expectedId);
        assertEq(nft.ownerOf(id), supplier);
        assertEq(nft.batchIdOf(id), BATCH);
        assertGt(bytes(nft.tokenURI(id)).length, bytes(nft.URI_PREFIX()).length);
    }

    function test_SupportsInterface() public view {
        assertTrue(nft.supportsInterface(type(IERC721).interfaceId));
        assertTrue(nft.supportsInterface(type(IAccessControl).interfaceId));
    }

    // --- reverts ---

    function test_Revert_NotMinter() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.MINTER_ROLE
            )
        );
        nft.mintReceivable(BATCH, supplier);
    }

    function test_Revert_ZeroAddress() public {
        vm.prank(minter);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        nft.mintReceivable(BATCH, address(0));
    }

    function test_Revert_NotAttested() public {
        att.setAttested(BATCH, false, 0);
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(InvoiceNFT.NotAttested.selector, BATCH));
        nft.mintReceivable(BATCH, supplier);
    }

    function test_Revert_NotFundedOrAttested() public {
        bytes32 noDeal = keccak256("no-deal");
        att.setAttested(noDeal, true, 9000);
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(InvoiceNFT.NotFundedOrAttested.selector, noDeal));
        nft.mintReceivable(noDeal, supplier);
    }

    function test_Revert_AlreadyMinted() public {
        vm.startPrank(minter);
        nft.mintReceivable(BATCH, supplier);
        vm.expectRevert(abi.encodeWithSelector(InvoiceNFT.AlreadyMinted.selector, uint256(BATCH)));
        nft.mintReceivable(BATCH, lender);
        vm.stopPrank();
    }

    function test_Revert_TokenURI_Nonexistent() public {
        vm.expectRevert();
        nft.tokenURI(uint256(BATCH));
    }
}
