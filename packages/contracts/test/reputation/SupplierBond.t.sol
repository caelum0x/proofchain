// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { SupplierBond } from "../../src/reputation/SupplierBond.sol";
import { ISupplierBond } from "../../src/interfaces/ISupplierBond.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockStablecoinRegistry } from "./mocks/MockStablecoinRegistry.sol";
import { ReenterERC20 } from "./mocks/ReenterERC20.sol";

contract SupplierBondTest is Test {
    AddressBook internal book;
    MockStablecoinRegistry internal registry;
    SupplierBond internal bond;
    MockUSDC internal token;

    address internal admin = address(0xA11CE);
    address internal locker = address(0x10C4);
    address internal slashController = address(0x51A54);
    address internal supplier = address(0xB0B);
    address internal treasury = address(0x7);
    address internal stranger = address(0xDEAD);

    uint256 internal constant AMOUNT = 1_000e6;

    event BondDeposited(address indexed supplier, address indexed token, uint256 amount);
    event BondWithdrawn(address indexed supplier, address indexed token, uint256 amount);
    event BondSlashed(address indexed supplier, uint256 amount, address indexed to);
    event BondLocked(address indexed supplier, uint256 amount);
    event BondUnlocked(address indexed supplier, uint256 amount);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        registry = new MockStablecoinRegistry();
        bond = new SupplierBond(address(book), admin);
        bond.grantRole(bond.BOND_LOCKER_ROLE(), locker);
        book.setAddress(Keys.STABLECOIN_REGISTRY, address(registry));
        book.setAddress(Keys.SLASHING_CONTROLLER, slashController);
        vm.stopPrank();

        token = new MockUSDC();
        registry.addToken(address(token), 6);

        token.mint(supplier, AMOUNT);
        vm.prank(supplier);
        token.approve(address(bond), type(uint256).max);
    }

    function _deposit(uint256 amount) internal {
        vm.prank(supplier);
        bond.depositBond(address(token), amount);
    }

    // --- deposit ---

    function test_Deposit_HappyPath() public {
        vm.expectEmit(true, true, false, true);
        emit BondDeposited(supplier, address(token), AMOUNT);
        _deposit(AMOUNT);

        assertEq(bond.bondOf(supplier), AMOUNT);
        assertEq(bond.unlockedOf(supplier), AMOUNT);
        assertEq(bond.bondTokenOf(supplier), address(token));
        assertEq(token.balanceOf(address(bond)), AMOUNT);
    }

    function test_Deposit_RevertsZeroAmount() public {
        vm.prank(supplier);
        vm.expectRevert(ISupplierBond.ZeroAmount.selector);
        bond.depositBond(address(token), 0);
    }

    function test_Deposit_RevertsTokenNotAccepted() public {
        MockUSDC other = new MockUSDC();
        other.mint(supplier, AMOUNT);
        vm.startPrank(supplier);
        other.approve(address(bond), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(ISupplierBond.TokenNotAccepted.selector, address(other)));
        bond.depositBond(address(other), AMOUNT);
        vm.stopPrank();
    }

    function test_Deposit_RevertsTokenMismatch() public {
        _deposit(400e6);
        MockUSDC other = new MockUSDC();
        registry.addToken(address(other), 6);
        other.mint(supplier, 100e6);
        vm.startPrank(supplier);
        other.approve(address(bond), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(SupplierBond.TokenMismatch.selector, supplier, address(token), address(other))
        );
        bond.depositBond(address(other), 100e6);
        vm.stopPrank();
    }

    // --- withdraw ---

    function test_Withdraw_HappyPath() public {
        _deposit(AMOUNT);
        vm.expectEmit(true, true, false, true);
        emit BondWithdrawn(supplier, address(token), 300e6);
        vm.prank(supplier);
        bond.withdrawBond(address(token), 300e6);

        assertEq(bond.bondOf(supplier), 700e6);
        assertEq(token.balanceOf(supplier), 300e6);
    }

    function test_Withdraw_RevertsExceedsUnlocked() public {
        _deposit(AMOUNT);
        vm.prank(locker);
        bond.lockBond(supplier, 800e6);
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(ISupplierBond.InsufficientUnlockedBond.selector, supplier, 300e6, 200e6));
        bond.withdrawBond(address(token), 300e6);
    }

    function test_Withdraw_RevertsTokenMismatch() public {
        _deposit(AMOUNT);
        vm.prank(supplier);
        vm.expectRevert(
            abi.encodeWithSelector(SupplierBond.TokenMismatch.selector, supplier, address(token), address(1))
        );
        bond.withdrawBond(address(1), 100e6);
    }

    // --- lock / unlock ---

    function test_LockUnlock_HappyPath() public {
        _deposit(AMOUNT);
        vm.startPrank(locker);
        vm.expectEmit(true, false, false, true);
        emit BondLocked(supplier, 600e6);
        bond.lockBond(supplier, 600e6);
        assertEq(bond.lockedOf(supplier), 600e6);

        vm.expectEmit(true, false, false, true);
        emit BondUnlocked(supplier, 200e6);
        bond.unlockBond(supplier, 200e6);
        assertEq(bond.lockedOf(supplier), 400e6);
        vm.stopPrank();
    }

    function test_Lock_RevertsUnauthorized() public {
        _deposit(AMOUNT);
        bytes32 _role = bond.BOND_LOCKER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        bond.lockBond(supplier, 100e6);
    }

    // --- slash ---

    function test_SlashBond_HappyPath() public {
        _deposit(AMOUNT);
        vm.expectEmit(true, true, false, true);
        emit BondSlashed(supplier, 400e6, treasury);
        vm.prank(slashController);
        bond.slashBond(supplier, 400e6, treasury);

        assertEq(bond.bondOf(supplier), 600e6);
        assertEq(token.balanceOf(treasury), 400e6);
    }

    function test_SlashBond_RevertsNotSlasher() public {
        _deposit(AMOUNT);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISupplierBond.NotSlasher.selector, stranger));
        bond.slashBond(supplier, 100e6, treasury);
    }

    function test_SlashBond_RevertsExceedsBond() public {
        _deposit(AMOUNT);
        vm.prank(slashController);
        vm.expectRevert(
            abi.encodeWithSelector(ISupplierBond.InsufficientUnlockedBond.selector, supplier, 1_500e6, AMOUNT)
        );
        bond.slashBond(supplier, 1_500e6, treasury);
    }

    function test_SlashBond_ReducesLocked() public {
        _deposit(AMOUNT);
        vm.prank(locker);
        bond.lockBond(supplier, 900e6);
        vm.prank(slashController);
        bond.slashBond(supplier, 950e6, treasury);
        assertEq(bond.bondOf(supplier), 50e6);
        assertEq(bond.lockedOf(supplier), 50e6);
        assertEq(token.balanceOf(treasury), 950e6);
    }

    // --- reentrancy (money-movement safety) ---

    function test_Withdraw_ReentrancyBlocked() public {
        ReenterERC20 evil = new ReenterERC20();
        registry.addToken(address(evil), 18);
        evil.mint(supplier, AMOUNT);
        vm.startPrank(supplier);
        evil.approve(address(bond), type(uint256).max);
        bond.depositBond(address(evil), AMOUNT);
        vm.stopPrank();

        evil.arm(address(bond), abi.encodeWithSelector(bond.withdrawBond.selector, address(evil), 100e6));

        vm.prank(supplier);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        bond.withdrawBond(address(evil), 100e6);
    }
}
