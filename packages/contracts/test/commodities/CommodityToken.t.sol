// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { CommodityToken } from "../../src/commodities/CommodityToken.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { ICommodityToken } from "../../src/interfaces/ICommodityToken.sol";

contract CommodityTokenTest is Test {
    AddressBook internal book;
    CommodityToken internal token;

    address internal admin = address(0xA11CE);
    address internal vault = address(0x7A017);
    address internal alice = address(0xA71CE);
    address internal bob = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant CODE = keccak256("ARABICA-A");
    bytes32 internal constant GRADE = keccak256("A");
    bytes32 internal constant RECEIPT = keccak256("receipt-1");

    event Minted(address indexed to, uint256 amount, bytes32 indexed receiptId);
    event Burned(address indexed from, uint256 amount, bytes32 indexed receiptId);

    function setUp() public {
        book = new AddressBook(admin);
        token = new CommodityToken(address(book), admin, "ProofChain Arabica A", "cARAB-A", CODE, GRADE);

        vm.prank(admin);
        book.setAddress(Keys.COMMODITY_VAULT, vault);
    }

    function test_Metadata() public view {
        assertEq(token.name(), "ProofChain Arabica A");
        assertEq(token.symbol(), "cARAB-A");
        assertEq(token.decimals(), 18);
        assertEq(token.commodityCode(), CODE);
        assertEq(token.grade(), GRADE);
    }

    function test_Mint_HappyPath() public {
        vm.expectEmit(true, true, false, true, address(token));
        emit Minted(alice, 1000e18, RECEIPT);

        vm.prank(vault);
        token.mint(alice, 1000e18, RECEIPT);

        assertEq(token.balanceOf(alice), 1000e18);
        assertEq(token.totalSupply(), 1000e18);
    }

    function test_Burn_HappyPath() public {
        vm.startPrank(vault);
        token.mint(alice, 1000e18, RECEIPT);

        vm.expectEmit(true, true, false, true, address(token));
        emit Burned(alice, 400e18, RECEIPT);
        token.burn(alice, 400e18, RECEIPT);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 600e18);
        assertEq(token.totalSupply(), 600e18);
    }

    function test_Transfer_StandardERC20() public {
        vm.prank(vault);
        token.mint(alice, 1000e18, RECEIPT);

        vm.prank(alice);
        token.transfer(bob, 250e18);

        assertEq(token.balanceOf(alice), 750e18);
        assertEq(token.balanceOf(bob), 250e18);
    }

    function test_RevertWhen_NonVaultMints() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ICommodityToken.NotVault.selector, stranger));
        token.mint(alice, 1000e18, RECEIPT);
    }

    function test_RevertWhen_NonVaultBurns() public {
        vm.prank(vault);
        token.mint(alice, 1000e18, RECEIPT);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ICommodityToken.NotVault.selector, stranger));
        token.burn(alice, 100e18, RECEIPT);
    }

    function test_RevertWhen_MintZeroAmount() public {
        vm.prank(vault);
        vm.expectRevert(ICommodityToken.ZeroAmount.selector);
        token.mint(alice, 0, RECEIPT);
    }

    function test_RevertWhen_MintToZero() public {
        vm.prank(vault);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        token.mint(address(0), 1000e18, RECEIPT);
    }

    function test_RevertWhen_BurnMoreThanBalance() public {
        vm.startPrank(vault);
        token.mint(alice, 100e18, RECEIPT);
        vm.expectRevert(abi.encodeWithSelector(ICommodityToken.InsufficientBalance.selector, alice, 200e18, 100e18));
        token.burn(alice, 200e18, RECEIPT);
        vm.stopPrank();
    }
}
