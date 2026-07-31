// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Pauser } from "../../src/core/Pauser.sol";
import { Keys } from "../../src/core/Keys.sol";
import { SupplierRegistry } from "../../src/identity/SupplierRegistry.sol";
import { ISupplierRegistry } from "../../src/interfaces/ISupplierRegistry.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";

contract SupplierRegistryTest is Test {
    AddressBook internal book;
    SupplierRegistry internal reg;

    address internal admin = address(0xA11CE);
    address internal supplier = address(0x5011D);
    address internal other = address(0xBEEF);

    event SupplierRegistered(address indexed account, string name, string uri);
    event SupplierUpdated(address indexed account, string name, string uri);

    function setUp() public {
        book = new AddressBook(admin);
        reg = new SupplierRegistry(address(book), admin);
    }

    function test_Register_StoresAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit SupplierRegistered(supplier, "Acme Foods", "ipfs://p");
        vm.prank(supplier);
        reg.registerSupplier("Acme Foods", "ipfs://p");

        ISupplierRegistry.Profile memory p = reg.profileOf(supplier);
        assertEq(p.account, supplier);
        assertEq(p.name, "Acme Foods");
        assertEq(p.uri, "ipfs://p");
        assertEq(p.registeredAt, uint64(block.timestamp));
        assertTrue(p.exists);
        assertTrue(reg.isSupplier(supplier));
    }

    function test_Register_RevertsEmptyName() public {
        vm.prank(supplier);
        vm.expectRevert(ISupplierRegistry.EmptyName.selector);
        reg.registerSupplier("", "ipfs://p");
    }

    function test_Register_RevertsAlreadyRegistered() public {
        vm.startPrank(supplier);
        reg.registerSupplier("Acme", "ipfs://p");
        vm.expectRevert(abi.encodeWithSelector(ISupplierRegistry.AlreadyRegistered.selector, supplier));
        reg.registerSupplier("Acme Again", "ipfs://q");
        vm.stopPrank();
    }

    function test_Update_ChangesFieldsKeepsRegisteredAt() public {
        vm.startPrank(supplier);
        reg.registerSupplier("Acme", "ipfs://p");
        uint64 registeredAt = reg.profileOf(supplier).registeredAt;
        vm.warp(block.timestamp + 1000);

        vm.expectEmit(true, true, true, true);
        emit SupplierUpdated(supplier, "Acme v2", "ipfs://p2");
        reg.updateSupplier("Acme v2", "ipfs://p2");
        vm.stopPrank();

        ISupplierRegistry.Profile memory p = reg.profileOf(supplier);
        assertEq(p.name, "Acme v2");
        assertEq(p.uri, "ipfs://p2");
        assertEq(p.registeredAt, registeredAt);
    }

    function test_Update_RevertsNotRegistered() public {
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(ISupplierRegistry.NotRegistered.selector, other));
        reg.updateSupplier("X", "ipfs://x");
    }

    function test_Update_RevertsEmptyName() public {
        vm.startPrank(supplier);
        reg.registerSupplier("Acme", "ipfs://p");
        vm.expectRevert(ISupplierRegistry.EmptyName.selector);
        reg.updateSupplier("", "ipfs://p");
        vm.stopPrank();
    }

    function test_IsSupplier_FalseForUnknown() public view {
        assertFalse(reg.isSupplier(other));
    }

    function test_GlobalPause_BlocksRegister() public {
        Pauser pauser = new Pauser(admin);
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.prank(supplier);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        reg.registerSupplier("Acme", "ipfs://p");
    }
}
