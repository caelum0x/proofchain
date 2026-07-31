// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Pauser } from "../../src/core/Pauser.sol";
import { Keys } from "../../src/core/Keys.sol";
import { CarrierRegistry } from "../../src/identity/CarrierRegistry.sol";
import { ICarrierRegistry } from "../../src/interfaces/ICarrierRegistry.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";

contract CarrierRegistryTest is Test {
    AddressBook internal book;
    CarrierRegistry internal reg;

    address internal admin = address(0xA11CE);
    address internal carrier = address(0xCA44);
    address internal other = address(0xBEEF);

    event CarrierRegistered(address indexed account, string name, string uri);
    event CarrierUpdated(address indexed account, string name, string uri);

    function setUp() public {
        book = new AddressBook(admin);
        reg = new CarrierRegistry(address(book), admin);
    }

    function test_Register_StoresAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit CarrierRegistered(carrier, "FastFreight", "ipfs://p");
        vm.prank(carrier);
        reg.registerCarrier("FastFreight", "ipfs://p");

        ICarrierRegistry.Profile memory p = reg.profileOf(carrier);
        assertEq(p.account, carrier);
        assertEq(p.name, "FastFreight");
        assertTrue(p.exists);
        assertTrue(reg.isCarrier(carrier));
    }

    function test_Register_RevertsEmptyName() public {
        vm.prank(carrier);
        vm.expectRevert(ICarrierRegistry.EmptyName.selector);
        reg.registerCarrier("", "ipfs://p");
    }

    function test_Register_RevertsAlreadyRegistered() public {
        vm.startPrank(carrier);
        reg.registerCarrier("FastFreight", "ipfs://p");
        vm.expectRevert(abi.encodeWithSelector(ICarrierRegistry.AlreadyRegistered.selector, carrier));
        reg.registerCarrier("Again", "ipfs://q");
        vm.stopPrank();
    }

    function test_Update_ChangesFields() public {
        vm.startPrank(carrier);
        reg.registerCarrier("FastFreight", "ipfs://p");
        vm.expectEmit(true, true, true, true);
        emit CarrierUpdated(carrier, "FastFreight v2", "ipfs://p2");
        reg.updateCarrier("FastFreight v2", "ipfs://p2");
        vm.stopPrank();

        ICarrierRegistry.Profile memory p = reg.profileOf(carrier);
        assertEq(p.name, "FastFreight v2");
        assertEq(p.uri, "ipfs://p2");
    }

    function test_Update_RevertsNotRegistered() public {
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(ICarrierRegistry.NotRegistered.selector, other));
        reg.updateCarrier("X", "ipfs://x");
    }

    function test_IsCarrier_FalseForUnknown() public view {
        assertFalse(reg.isCarrier(other));
    }

    function test_GlobalPause_BlocksRegister() public {
        Pauser pauser = new Pauser(admin);
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.prank(carrier);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        reg.registerCarrier("FastFreight", "ipfs://p");
    }
}
