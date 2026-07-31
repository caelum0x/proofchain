// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { RiskPool } from "../../src/insurance/RiskPool.sol";
import { IRiskPool } from "../../src/interfaces/IRiskPool.sol";

contract RiskPoolTest is Test {
    AddressBook internal book;
    MockUSDC internal usdc;
    RiskPool internal risk;

    address internal admin = address(0xA11CE);
    // These EOAs stand in for the wired InsurancePool / ClaimsProcessor callers.
    address internal poolAddr = address(0x9001);
    address internal claimsAddr = address(0x9002);
    address internal funder = address(0xF00D);
    address internal payee = address(0xBEEF);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant POLICY = keccak256("policy-1");

    event ToppedUp(address indexed from, address indexed token, uint256 amount);
    event Covered(bytes32 indexed policyId, address indexed to, uint256 amount);

    function setUp() public {
        book = new AddressBook(admin);
        usdc = new MockUSDC();
        risk = new RiskPool(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.INSURANCE_POOL, poolAddr);
        book.setAddress(Keys.CLAIMS_PROCESSOR, claimsAddr);
        vm.stopPrank();

        usdc.mint(funder, 1_000e6);
        vm.prank(funder);
        usdc.approve(address(risk), type(uint256).max);
    }

    function test_TopUp_AddsReserves() public {
        vm.expectEmit(true, true, false, true);
        emit ToppedUp(funder, address(usdc), 500e6);
        vm.prank(funder);
        risk.topUp(address(usdc), 500e6);

        assertEq(risk.reserves(address(usdc)), 500e6);
        assertEq(usdc.balanceOf(address(risk)), 500e6);
    }

    function test_TopUp_RevertsZeroAmount() public {
        vm.prank(funder);
        vm.expectRevert(IRiskPool.ZeroAmount.selector);
        risk.topUp(address(usdc), 0);
    }

    function test_Cover_ByInsurancePool() public {
        vm.prank(funder);
        risk.topUp(address(usdc), 500e6);

        vm.expectEmit(true, true, false, true);
        emit Covered(POLICY, payee, 200e6);
        vm.prank(poolAddr);
        risk.cover(POLICY, address(usdc), payee, 200e6);

        assertEq(risk.reserves(address(usdc)), 300e6);
        assertEq(usdc.balanceOf(payee), 200e6);
    }

    function test_Cover_ByClaimsProcessor() public {
        vm.prank(funder);
        risk.topUp(address(usdc), 500e6);
        vm.prank(claimsAddr);
        risk.cover(POLICY, address(usdc), payee, 100e6);
        assertEq(usdc.balanceOf(payee), 100e6);
    }

    function test_Cover_RevertsUnauthorized() public {
        vm.prank(funder);
        risk.topUp(address(usdc), 500e6);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IRiskPool.NotAuthorized.selector, stranger));
        risk.cover(POLICY, address(usdc), payee, 100e6);
    }

    function test_Cover_RevertsInsufficientReserves() public {
        vm.prank(funder);
        risk.topUp(address(usdc), 100e6);
        vm.prank(poolAddr);
        vm.expectRevert(abi.encodeWithSelector(IRiskPool.InsufficientReserves.selector, 200e6, 100e6));
        risk.cover(POLICY, address(usdc), payee, 200e6);
    }

    function test_Cover_RevertsZeroAmount() public {
        vm.prank(poolAddr);
        vm.expectRevert(IRiskPool.ZeroAmount.selector);
        risk.cover(POLICY, address(usdc), payee, 0);
    }
}
