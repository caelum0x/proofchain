// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { StakeManager } from "../../src/reputation/StakeManager.sol";
import { IStakeManager } from "../../src/interfaces/IStakeManager.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { ReenterERC20 } from "./mocks/ReenterERC20.sol";

contract StakeManagerTest is Test {
    AddressBook internal book;
    StakeManager internal sm;
    MockUSDC internal token;

    address internal admin = address(0xA11CE);
    address internal controller = address(0xC047D);
    address internal slasher = address(0x51A54);
    address internal alice = address(0xA11);
    address internal treasury = address(0x7);
    address internal stranger = address(0xDEAD);

    uint256 internal constant AMOUNT = 1_000e6;

    event Staked(address indexed account, address indexed token, uint256 amount);
    event Unstaked(address indexed account, address indexed token, uint256 amount);
    event Locked(address indexed account, uint256 amount);
    event Unlocked(address indexed account, uint256 amount);
    event StakeSlashed(address indexed account, uint256 amount, address indexed to);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        sm = new StakeManager(address(book), admin);
        sm.grantRole(sm.STAKE_CONTROLLER_ROLE(), controller);
        sm.grantRole(Roles.SLASHER_ROLE, slasher);
        vm.stopPrank();

        token = new MockUSDC();
        token.mint(alice, AMOUNT);
        vm.prank(alice);
        token.approve(address(sm), type(uint256).max);
    }

    function _stake(uint256 amount) internal {
        vm.prank(alice);
        sm.stake(address(token), amount);
    }

    // --- construction ---

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new StakeManager(address(0), admin);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new StakeManager(address(book), address(0));
    }

    // --- stake ---

    function test_Stake_HappyPath() public {
        vm.expectEmit(true, true, false, true);
        emit Staked(alice, address(token), AMOUNT);
        _stake(AMOUNT);

        assertEq(sm.stakeOf(alice), AMOUNT);
        assertEq(sm.unlockedOf(alice), AMOUNT);
        assertEq(sm.stakeTokenOf(alice), address(token));
        assertEq(token.balanceOf(address(sm)), AMOUNT);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_Stake_RevertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(IStakeManager.ZeroAmount.selector);
        sm.stake(address(token), 0);
    }

    function test_Stake_RevertsZeroToken() public {
        vm.prank(alice);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        sm.stake(address(0), AMOUNT);
    }

    function test_Stake_RevertsTokenMismatch() public {
        _stake(400e6);
        MockUSDC other = new MockUSDC();
        other.mint(alice, 100e6);
        vm.startPrank(alice);
        other.approve(address(sm), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(StakeManager.TokenMismatch.selector, alice, address(token), address(other))
        );
        sm.stake(address(other), 100e6);
        vm.stopPrank();
    }

    function test_Stake_Accumulates() public {
        _stake(400e6);
        _stake(200e6);
        assertEq(sm.stakeOf(alice), 600e6);
    }

    // --- unstake ---

    function test_Unstake_HappyPath() public {
        _stake(AMOUNT);
        vm.expectEmit(true, true, false, true);
        emit Unstaked(alice, address(token), 300e6);
        vm.prank(alice);
        sm.unstake(address(token), 300e6);

        assertEq(sm.stakeOf(alice), 700e6);
        assertEq(token.balanceOf(alice), 300e6);
    }

    function test_Unstake_RevertsExceedsUnlocked() public {
        _stake(AMOUNT);
        vm.prank(controller);
        sm.lock(alice, 800e6);
        // Only 200 unlocked.
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IStakeManager.InsufficientUnlocked.selector, alice, 300e6, 200e6));
        sm.unstake(address(token), 300e6);
    }

    function test_Unstake_RevertsTokenMismatch() public {
        _stake(AMOUNT);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(StakeManager.TokenMismatch.selector, alice, address(token), address(1)));
        sm.unstake(address(1), 100e6);
    }

    function test_Unstake_RevertsZeroAmount() public {
        _stake(AMOUNT);
        vm.prank(alice);
        vm.expectRevert(IStakeManager.ZeroAmount.selector);
        sm.unstake(address(token), 0);
    }

    // --- lock / unlock ---

    function test_Lock_HappyPath() public {
        _stake(AMOUNT);
        vm.expectEmit(true, false, false, true);
        emit Locked(alice, 600e6);
        vm.prank(controller);
        sm.lock(alice, 600e6);
        assertEq(sm.lockedOf(alice), 600e6);
        assertEq(sm.unlockedOf(alice), 400e6);
    }

    function test_Lock_RevertsUnauthorized() public {
        _stake(AMOUNT);
        bytes32 _role = sm.STAKE_CONTROLLER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        sm.lock(alice, 100e6);
    }

    function test_Lock_RevertsExceedsAvailable() public {
        _stake(AMOUNT);
        vm.prank(controller);
        vm.expectRevert(abi.encodeWithSelector(IStakeManager.InsufficientUnlocked.selector, alice, 1_200e6, AMOUNT));
        sm.lock(alice, 1_200e6);
    }

    function test_Unlock_HappyPath() public {
        _stake(AMOUNT);
        vm.startPrank(controller);
        sm.lock(alice, 600e6);
        vm.expectEmit(true, false, false, true);
        emit Unlocked(alice, 250e6);
        sm.unlock(alice, 250e6);
        vm.stopPrank();
        assertEq(sm.lockedOf(alice), 350e6);
    }

    function test_Unlock_RevertsExceedsLocked() public {
        _stake(AMOUNT);
        vm.startPrank(controller);
        sm.lock(alice, 300e6);
        vm.expectRevert(abi.encodeWithSelector(IStakeManager.InsufficientStake.selector, alice, 400e6, 300e6));
        sm.unlock(alice, 400e6);
        vm.stopPrank();
    }

    // --- slash ---

    function test_Slash_HappyPath() public {
        _stake(AMOUNT);
        vm.expectEmit(true, true, false, true);
        emit StakeSlashed(alice, 400e6, treasury);
        vm.prank(slasher);
        sm.slash(alice, 400e6, treasury);

        assertEq(sm.stakeOf(alice), 600e6);
        assertEq(token.balanceOf(treasury), 400e6);
    }

    function test_Slash_ReducesLockedWhenExceedingUnlocked() public {
        _stake(AMOUNT);
        vm.prank(controller);
        sm.lock(alice, 900e6); // 100 unlocked, 900 locked
        vm.prank(slasher);
        sm.slash(alice, 950e6, treasury); // eats all unlocked + into locked
        assertEq(sm.stakeOf(alice), 50e6);
        // locked can never exceed remaining stake.
        assertEq(sm.lockedOf(alice), 50e6);
        assertEq(token.balanceOf(treasury), 950e6);
    }

    function test_Slash_RevertsUnauthorized() public {
        _stake(AMOUNT);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.SLASHER_ROLE
            )
        );
        sm.slash(alice, 100e6, treasury);
    }

    function test_Slash_RevertsExceedsStake() public {
        _stake(AMOUNT);
        vm.prank(slasher);
        vm.expectRevert(abi.encodeWithSelector(IStakeManager.InsufficientStake.selector, alice, 1_500e6, AMOUNT));
        sm.slash(alice, 1_500e6, treasury);
    }

    function test_Slash_RevertsZeroTo() public {
        _stake(AMOUNT);
        vm.prank(slasher);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        sm.slash(alice, 100e6, address(0));
    }

    // --- reentrancy (money-movement safety) ---

    function test_Unstake_ReentrancyBlocked() public {
        ReenterERC20 evil = new ReenterERC20();
        evil.mint(alice, AMOUNT);
        vm.startPrank(alice);
        evil.approve(address(sm), type(uint256).max);
        sm.stake(address(evil), AMOUNT);
        vm.stopPrank();

        // Arm the token to re-enter unstake during the outbound transfer.
        evil.arm(address(sm), abi.encodeWithSelector(sm.unstake.selector, address(evil), 100e6));

        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        sm.unstake(address(evil), 100e6);
    }
}
