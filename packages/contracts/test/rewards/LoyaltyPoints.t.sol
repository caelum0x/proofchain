// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { Roles } from "../../src/core/Roles.sol";
import { LoyaltyPoints } from "../../src/rewards/LoyaltyPoints.sol";
import { ILoyaltyPoints } from "../../src/interfaces/ILoyaltyPoints.sol";

contract LoyaltyPointsTest is Test {
    LoyaltyPoints internal points;

    address internal admin = address(0xA11CE);
    address internal minter = address(0x31137E5);
    address internal alice = address(0xA11);
    address internal bob = address(0xB0B);
    address internal stranger = address(0xDEAD);

    uint256 internal constant AMOUNT = 1_000e18;

    event Awarded(address indexed to, uint256 amount);
    event TransferabilityUpdated(bool transferable);

    function _deploy(bool transferable) internal {
        vm.prank(admin);
        points = new LoyaltyPoints(admin, minter, transferable);
    }

    // --- construction ---

    function test_Constructor_SetsRolesAndTransferability() public {
        _deploy(false);
        assertTrue(points.hasRole(points.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(points.hasRole(Roles.MINTER_ROLE, minter));
        assertFalse(points.transferable());
        assertEq(points.name(), "ProofChain Loyalty");
        assertEq(points.symbol(), "LOYAL");
    }

    function test_Constructor_RevertsZeroAdmin() public {
        vm.expectRevert(ILoyaltyPoints.ZeroAddress.selector);
        new LoyaltyPoints(address(0), minter, false);
    }

    function test_Constructor_RevertsZeroMinter() public {
        vm.expectRevert(ILoyaltyPoints.ZeroAddress.selector);
        new LoyaltyPoints(admin, address(0), false);
    }

    // --- award ---

    function test_Award_HappyPath() public {
        _deploy(false);
        vm.expectEmit(true, false, false, true);
        emit Awarded(alice, AMOUNT);
        vm.prank(minter);
        points.award(alice, AMOUNT);
        assertEq(points.balanceOf(alice), AMOUNT);
        assertEq(points.totalSupply(), AMOUNT);
    }

    function test_Award_RevertsUnauthorized() public {
        _deploy(false);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.MINTER_ROLE)
        );
        points.award(alice, AMOUNT);
    }

    function test_Award_RevertsZeroAddress() public {
        _deploy(false);
        vm.prank(minter);
        vm.expectRevert(ILoyaltyPoints.ZeroAddress.selector);
        points.award(address(0), AMOUNT);
    }

    function test_Award_RevertsZeroAmount() public {
        _deploy(false);
        vm.prank(minter);
        vm.expectRevert(ILoyaltyPoints.ZeroAmount.selector);
        points.award(alice, 0);
    }

    // --- soulbound (non-transferable) behaviour ---

    function test_Transfer_RevertsWhenNonTransferable() public {
        _deploy(false);
        vm.prank(minter);
        points.award(alice, AMOUNT);
        vm.prank(alice);
        vm.expectRevert(ILoyaltyPoints.NonTransferable.selector);
        points.transfer(bob, 100e18);
    }

    function test_TransferFrom_RevertsWhenNonTransferable() public {
        _deploy(false);
        vm.prank(minter);
        points.award(alice, AMOUNT);
        vm.prank(alice);
        points.approve(bob, 100e18);
        vm.prank(bob);
        vm.expectRevert(ILoyaltyPoints.NonTransferable.selector);
        points.transferFrom(alice, bob, 100e18);
    }

    function test_Mint_AllowedWhenNonTransferable() public {
        // Minting is a transfer from address(0) and must always be allowed.
        _deploy(false);
        vm.prank(minter);
        points.award(alice, AMOUNT);
        assertEq(points.balanceOf(alice), AMOUNT);
    }

    // --- transferability switch ---

    function test_SetTransferable_EnablesTransfers() public {
        _deploy(false);
        vm.prank(minter);
        points.award(alice, AMOUNT);

        vm.expectEmit(false, false, false, true);
        emit TransferabilityUpdated(true);
        vm.prank(admin);
        points.setTransferable(true);
        assertTrue(points.transferable());

        vm.prank(alice);
        points.transfer(bob, 250e18);
        assertEq(points.balanceOf(bob), 250e18);
        assertEq(points.balanceOf(alice), 750e18);
    }

    function test_SetTransferable_RevertsUnauthorized() public {
        _deploy(false);
        bytes32 _role = points.DEFAULT_ADMIN_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        points.setTransferable(true);
    }

    function test_SetTransferable_CanReDisable() public {
        _deploy(true);
        vm.prank(minter);
        points.award(alice, AMOUNT);
        vm.prank(admin);
        points.setTransferable(false);
        assertFalse(points.transferable());
        vm.prank(alice);
        vm.expectRevert(ILoyaltyPoints.NonTransferable.selector);
        points.transfer(bob, 1);
    }
}
