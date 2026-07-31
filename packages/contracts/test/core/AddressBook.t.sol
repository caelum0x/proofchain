// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { IAddressBook } from "../../src/interfaces/IAddressBook.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract AddressBookTest is Test {
    AddressBook internal book;
    address internal admin = address(0xA11CE);
    address internal stranger = address(0xBEEF);

    bytes32 internal constant KEY = keccak256("SomeContract");
    address internal constant TARGET = address(0xCAFE);

    event AddressSet(bytes32 indexed key, address indexed oldAddr, address indexed newAddr);

    function setUp() public {
        book = new AddressBook(admin);
    }

    function test_Constructor_RevertsZeroAdmin() public {
        vm.expectRevert(IAddressBook.ZeroAddress.selector);
        new AddressBook(address(0));
    }

    function test_SetAddress_EmitsAndStores() public {
        vm.expectEmit(true, true, true, true);
        emit AddressSet(KEY, address(0), TARGET);
        vm.prank(admin);
        book.setAddress(KEY, TARGET);

        assertEq(book.getAddress(KEY), TARGET);
        assertEq(book.requireAddress(KEY), TARGET);
    }

    function test_SetAddress_Repoint() public {
        vm.startPrank(admin);
        book.setAddress(KEY, TARGET);
        address next = address(0xD00D);
        vm.expectEmit(true, true, true, true);
        emit AddressSet(KEY, TARGET, next);
        book.setAddress(KEY, next);
        vm.stopPrank();
        assertEq(book.getAddress(KEY), next);
    }

    function test_SetAddress_RevertsZeroKey() public {
        vm.prank(admin);
        vm.expectRevert(IAddressBook.ZeroKey.selector);
        book.setAddress(bytes32(0), TARGET);
    }

    function test_SetAddress_RevertsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(IAddressBook.ZeroAddress.selector);
        book.setAddress(KEY, address(0));
    }

    function test_SetAddress_RevertsUnauthorized() public {
        bytes32 adminRole = book.DEFAULT_ADMIN_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, adminRole)
        );
        book.setAddress(KEY, TARGET);
    }

    function test_GetAddress_UnsetReturnsZero() public view {
        assertEq(book.getAddress(keccak256("nope")), address(0));
    }

    function test_RequireAddress_RevertsWhenUnset() public {
        bytes32 missing = keccak256("nope");
        vm.expectRevert(abi.encodeWithSelector(IAddressBook.AddressNotFound.selector, missing));
        book.requireAddress(missing);
    }
}
