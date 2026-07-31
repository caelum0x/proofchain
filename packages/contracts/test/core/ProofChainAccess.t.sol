// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Pauser } from "../../src/core/Pauser.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { IAddressBook } from "../../src/interfaces/IAddressBook.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";
import { Keys } from "../../src/core/Keys.sol";

/// @dev Minimal concrete module exposing the internal ProofChainAccess helpers for testing.
contract AccessHarness is ProofChainAccess {
    constructor(address book, address admin) ProofChainAccess(book, admin) { }

    function resolve(bytes32 key) external view returns (address) {
        return _addr(key);
    }

    function resolveOrZero(bytes32 key) external view returns (address) {
        return _addrOrZero(key);
    }

    function guardedRead() external view returns (bool) {
        _requireNotGloballyPaused();
        return true;
    }
}

contract ProofChainAccessTest is Test {
    AddressBook internal book;
    Pauser internal pauser;
    AccessHarness internal harness;

    address internal admin = address(0xA11CE);
    bytes32 internal constant KEY = keccak256("Peer");
    address internal constant PEER = address(0xCAFE);

    function setUp() public {
        book = new AddressBook(admin);
        pauser = new Pauser(admin);
        harness = new AccessHarness(address(book), admin);
    }

    function test_Constructor_RevertsZeroBook() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new AccessHarness(address(0), admin);
    }

    function test_Constructor_RevertsZeroAdmin() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new AccessHarness(address(book), address(0));
    }

    function test_AdminRoleGranted() public view {
        assertTrue(harness.hasRole(harness.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Resolve_ReturnsRegisteredPeer() public {
        vm.prank(admin);
        book.setAddress(KEY, PEER);
        assertEq(harness.resolve(KEY), PEER);
    }

    function test_Resolve_RevertsWhenUnset() public {
        vm.expectRevert(abi.encodeWithSelector(IAddressBook.AddressNotFound.selector, KEY));
        harness.resolve(KEY);
    }

    function test_ResolveOrZero_ReturnsZeroWhenUnset() public view {
        assertEq(harness.resolveOrZero(KEY), address(0));
    }

    function test_GlobalPause_NoopWhenPauserUnset() public view {
        // Pauser key not wired -> guard is a no-op and read succeeds.
        assertTrue(harness.guardedRead());
    }

    function test_GlobalPause_BlocksWhenPaused() public {
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.expectRevert(IPauser.EnforcedPause.selector);
        harness.guardedRead();
    }

    function test_GlobalPause_PassesWhenWiredButNotPaused() public {
        vm.prank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        assertTrue(harness.guardedRead());
    }
}
