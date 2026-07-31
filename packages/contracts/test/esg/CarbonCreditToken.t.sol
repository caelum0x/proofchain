// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

import { Test } from "forge-std/Test.sol";

import { CarbonCreditToken } from "../../src/esg/CarbonCreditToken.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ICarbonCreditToken } from "../../src/interfaces/ICarbonCreditToken.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract CarbonCreditTokenTest is Test {
    AddressBook internal book;
    CarbonCreditToken internal credit;

    address internal admin = address(0xA11CE);
    address internal minter = address(0xB0B);
    address internal alice = address(0xA71CE);
    address internal operator = address(0x09E);
    address internal stranger = address(0xDEAD);

    uint256 internal constant PROJECT = 7;

    event Retired(address indexed account, uint256 indexed projectId, uint256 amount);

    function setUp() public {
        book = new AddressBook(admin);
        credit = new CarbonCreditToken(address(book), admin, "ipfs://carbon/{id}");

        vm.prank(admin);
        credit.grantRole(Roles.MINTER_ROLE, minter);
    }

    function test_Mint_HappyPath() public {
        vm.prank(minter);
        credit.mint(alice, PROJECT, 1000);
        assertEq(credit.balanceOf(alice, PROJECT), 1000);
    }

    function test_RevertWhen_MintToZero() public {
        vm.prank(minter);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        credit.mint(address(0), PROJECT, 1000);
    }

    function test_RevertWhen_MintZeroAmount() public {
        vm.prank(minter);
        vm.expectRevert(ICarbonCreditToken.ZeroAmount.selector);
        credit.mint(alice, PROJECT, 0);
    }

    function test_RevertWhen_NonMinterMints() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.MINTER_ROLE)
        );
        credit.mint(alice, PROJECT, 1000);
    }

    function test_Retire_HappyPath() public {
        vm.prank(minter);
        credit.mint(alice, PROJECT, 1000);

        vm.expectEmit(true, true, false, true, address(credit));
        emit Retired(alice, PROJECT, 400);

        vm.prank(alice);
        credit.retire(PROJECT, 400);

        assertEq(credit.balanceOf(alice, PROJECT), 600);
        assertEq(credit.retiredOf(PROJECT), 400);
    }

    function test_Retire_AccumulatesRetiredCounter() public {
        vm.prank(minter);
        credit.mint(alice, PROJECT, 1000);

        vm.startPrank(alice);
        credit.retire(PROJECT, 100);
        credit.retire(PROJECT, 250);
        vm.stopPrank();

        assertEq(credit.retiredOf(PROJECT), 350);
        assertEq(credit.balanceOf(alice, PROJECT), 650);
    }

    function test_RevertWhen_RetireZero() public {
        vm.prank(minter);
        credit.mint(alice, PROJECT, 1000);
        vm.prank(alice);
        vm.expectRevert(ICarbonCreditToken.ZeroAmount.selector);
        credit.retire(PROJECT, 0);
    }

    function test_RevertWhen_RetireMoreThanBalance() public {
        vm.prank(minter);
        credit.mint(alice, PROJECT, 100);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ICarbonCreditToken.InsufficientCredits.selector, PROJECT, 200, 100));
        credit.retire(PROJECT, 200);
    }

    function test_RetireFrom_ByApprovedOperator() public {
        vm.prank(minter);
        credit.mint(alice, PROJECT, 1000);

        vm.prank(alice);
        credit.setApprovalForAll(operator, true);

        vm.expectEmit(true, true, false, true, address(credit));
        emit Retired(alice, PROJECT, 300);

        vm.prank(operator);
        credit.retireFrom(alice, PROJECT, 300);

        assertEq(credit.balanceOf(alice, PROJECT), 700);
        assertEq(credit.retiredOf(PROJECT), 300);
    }

    function test_RevertWhen_RetireFromWithoutApproval() public {
        vm.prank(minter);
        credit.mint(alice, PROJECT, 1000);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(CarbonCreditToken.NotAuthorized.selector, operator, alice));
        credit.retireFrom(alice, PROJECT, 300);
    }

    function test_SupportsInterface() public view {
        assertTrue(credit.supportsInterface(0xd9b67a26)); // ERC1155
        assertTrue(credit.supportsInterface(0x7965db0b)); // IAccessControl
        assertTrue(credit.supportsInterface(0x01ffc9a7)); // ERC165
    }
}
