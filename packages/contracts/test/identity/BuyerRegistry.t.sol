// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Pauser } from "../../src/core/Pauser.sol";
import { Keys } from "../../src/core/Keys.sol";
import { BuyerRegistry } from "../../src/identity/BuyerRegistry.sol";
import { IBuyerRegistry } from "../../src/interfaces/IBuyerRegistry.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";

contract BuyerRegistryTest is Test {
    AddressBook internal book;
    BuyerRegistry internal reg;

    address internal admin = address(0xA11CE);
    address internal buyer = address(0xB0B);
    address internal other = address(0xBEEF);

    event BuyerRegistered(address indexed account, string name, string uri);
    event BuyerUpdated(address indexed account, string name, string uri);

    function setUp() public {
        book = new AddressBook(admin);
        reg = new BuyerRegistry(address(book), admin);
    }

    function test_Register_StoresAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit BuyerRegistered(buyer, "MegaMart", "ipfs://p");
        vm.prank(buyer);
        reg.registerBuyer("MegaMart", "ipfs://p");

        IBuyerRegistry.Profile memory p = reg.profileOf(buyer);
        assertEq(p.account, buyer);
        assertEq(p.name, "MegaMart");
        assertEq(p.uri, "ipfs://p");
        assertTrue(p.exists);
        assertTrue(reg.isBuyer(buyer));
    }

    function test_Register_RevertsEmptyName() public {
        vm.prank(buyer);
        vm.expectRevert(IBuyerRegistry.EmptyName.selector);
        reg.registerBuyer("", "ipfs://p");
    }

    function test_Register_RevertsAlreadyRegistered() public {
        vm.startPrank(buyer);
        reg.registerBuyer("MegaMart", "ipfs://p");
        vm.expectRevert(abi.encodeWithSelector(IBuyerRegistry.AlreadyRegistered.selector, buyer));
        reg.registerBuyer("Again", "ipfs://q");
        vm.stopPrank();
    }

    function test_Update_ChangesFields() public {
        vm.startPrank(buyer);
        reg.registerBuyer("MegaMart", "ipfs://p");
        vm.expectEmit(true, true, true, true);
        emit BuyerUpdated(buyer, "MegaMart v2", "ipfs://p2");
        reg.updateBuyer("MegaMart v2", "ipfs://p2");
        vm.stopPrank();

        IBuyerRegistry.Profile memory p = reg.profileOf(buyer);
        assertEq(p.name, "MegaMart v2");
        assertEq(p.uri, "ipfs://p2");
    }

    function test_Update_RevertsNotRegistered() public {
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(IBuyerRegistry.NotRegistered.selector, other));
        reg.updateBuyer("X", "ipfs://x");
    }

    function test_Update_RevertsEmptyName() public {
        vm.startPrank(buyer);
        reg.registerBuyer("MegaMart", "ipfs://p");
        vm.expectRevert(IBuyerRegistry.EmptyName.selector);
        reg.updateBuyer("", "ipfs://p");
        vm.stopPrank();
    }

    function test_IsBuyer_FalseForUnknown() public view {
        assertFalse(reg.isBuyer(other));
    }

    function test_GlobalPause_BlocksRegister() public {
        Pauser pauser = new Pauser(admin);
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.prank(buyer);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        reg.registerBuyer("MegaMart", "ipfs://p");
    }
}
