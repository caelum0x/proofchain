// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MockUSDC } from "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;
    address internal user = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
    }

    function test_Metadata() public view {
        assertEq(usdc.name(), "Mock USDC");
        assertEq(usdc.symbol(), "mUSDC");
        assertEq(usdc.decimals(), 6);
    }

    function test_Mint() public {
        usdc.mint(user, 1_000e6);
        assertEq(usdc.balanceOf(user), 1_000e6);
        assertEq(usdc.totalSupply(), 1_000e6);
    }

    function test_Mint_RevertsZeroAddress() public {
        vm.expectRevert(MockUSDC.ZeroAddress.selector);
        usdc.mint(address(0), 1_000e6);
    }

    function test_Mint_RevertsZeroAmount() public {
        vm.expectRevert(MockUSDC.ZeroAmount.selector);
        usdc.mint(user, 0);
    }

    function test_Transfer() public {
        usdc.mint(user, 1_000e6);
        vm.prank(user);
        usdc.transfer(address(0xCAFE), 400e6);
        assertEq(usdc.balanceOf(user), 600e6);
        assertEq(usdc.balanceOf(address(0xCAFE)), 400e6);
    }
}
