// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { StablecoinRegistry } from "../../src/payments/StablecoinRegistry.sol";
import { IStablecoinRegistry } from "../../src/interfaces/IStablecoinRegistry.sol";

contract StablecoinRegistryTest is Test {
    AddressBook internal book;
    StablecoinRegistry internal registry;

    address internal admin = address(0xA11CE);
    address internal stranger = address(0xBEEF);

    address internal usdc = address(0x1111);
    address internal usdt = address(0x2222);
    address internal dai = address(0x3333);

    event TokenAdded(address indexed token, uint8 decimals);
    event TokenRemoved(address indexed token);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new StablecoinRegistry(address(book), admin);
    }

    function test_AddToken_EmitsAndStores() public {
        vm.expectEmit(true, false, false, true);
        emit TokenAdded(usdc, 6);
        vm.prank(admin);
        registry.addToken(usdc, 6);

        assertTrue(registry.isAccepted(usdc));
        assertEq(registry.decimalsOf(usdc), 6);
        address[] memory list = registry.tokens();
        assertEq(list.length, 1);
        assertEq(list[0], usdc);
    }

    function test_AddToken_RevertsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        registry.addToken(address(0), 6);
    }

    function test_AddToken_RevertsAlreadyAdded() public {
        vm.startPrank(admin);
        registry.addToken(usdc, 6);
        vm.expectRevert(abi.encodeWithSelector(IStablecoinRegistry.TokenAlreadyAdded.selector, usdc));
        registry.addToken(usdc, 6);
        vm.stopPrank();
    }

    function test_AddToken_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        registry.addToken(usdc, 6);
    }

    function test_RemoveToken_MiddleElement_SwapAndPop() public {
        vm.startPrank(admin);
        registry.addToken(usdc, 6);
        registry.addToken(usdt, 6);
        registry.addToken(dai, 18);

        vm.expectEmit(true, false, false, false);
        emit TokenRemoved(usdt);
        registry.removeToken(usdt);
        vm.stopPrank();

        assertFalse(registry.isAccepted(usdt));
        assertTrue(registry.isAccepted(usdc));
        assertTrue(registry.isAccepted(dai));

        address[] memory list = registry.tokens();
        assertEq(list.length, 2);
        // swap-and-pop moved `dai` (last) into `usdt`'s slot.
        assertEq(list[0], usdc);
        assertEq(list[1], dai);
    }

    function test_RemoveToken_RevertsNotAccepted() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStablecoinRegistry.TokenNotAccepted.selector, usdc));
        registry.removeToken(usdc);
    }

    function test_ReAddAfterRemove_Works() public {
        vm.startPrank(admin);
        registry.addToken(usdc, 6);
        registry.removeToken(usdc);
        registry.addToken(usdc, 8);
        vm.stopPrank();

        assertTrue(registry.isAccepted(usdc));
        assertEq(registry.decimalsOf(usdc), 8);
        assertEq(registry.tokens().length, 1);
    }

    function test_DecimalsOf_RevertsWhenNotAccepted() public {
        vm.expectRevert(abi.encodeWithSelector(IStablecoinRegistry.TokenNotAccepted.selector, dai));
        registry.decimalsOf(dai);
    }

    function test_IsAccepted_FalseForUnknown() public view {
        assertFalse(registry.isAccepted(dai));
    }
}
