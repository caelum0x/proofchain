// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { IAddressBook } from "../../src/interfaces/IAddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { SlashingController } from "../../src/reputation/SlashingController.sol";
import { SupplierBond } from "../../src/reputation/SupplierBond.sol";
import { StakeManager } from "../../src/reputation/StakeManager.sol";
import { ISlashingController } from "../../src/interfaces/ISlashingController.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockStablecoinRegistry } from "./mocks/MockStablecoinRegistry.sol";
import { MockTreasury } from "./mocks/MockTreasury.sol";

contract SlashingControllerTest is Test {
    AddressBook internal book;
    MockStablecoinRegistry internal registry;
    MockTreasury internal treasury;
    SupplierBond internal bond;
    StakeManager internal sm;
    SlashingController internal controller;
    MockUSDC internal token;

    address internal admin = address(0xA11CE);
    address internal slasher = address(0x51A54);
    address internal supplier = address(0xB0B);
    address internal staker = address(0x57A);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant REASON = keccak256("PROVEN_FRAUD");
    uint256 internal constant AMOUNT = 1_000e6;

    event Slashed(address indexed who, uint256 amount, bytes32 indexed reason, address indexed to);
    event StakeSlashed(address indexed who, uint256 amount, bytes32 indexed reason, address indexed to);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        registry = new MockStablecoinRegistry();
        treasury = new MockTreasury();
        bond = new SupplierBond(address(book), admin);
        sm = new StakeManager(address(book), admin);
        controller = new SlashingController(address(book), admin);

        book.setAddress(Keys.STABLECOIN_REGISTRY, address(registry));
        book.setAddress(Keys.TREASURY, address(treasury));
        book.setAddress(Keys.SUPPLIER_BOND, address(bond));
        book.setAddress(Keys.STAKE_MANAGER, address(sm));
        book.setAddress(Keys.SLASHING_CONTROLLER, address(controller));

        // Caller authorisation to trigger slashing.
        controller.grantRole(Roles.SLASHER_ROLE, slasher);
        // The controller must hold SLASHER_ROLE on the StakeManager to seize stake.
        sm.grantRole(Roles.SLASHER_ROLE, address(controller));
        vm.stopPrank();

        token = new MockUSDC();
        registry.addToken(address(token), 6);

        token.mint(supplier, AMOUNT);
        vm.startPrank(supplier);
        token.approve(address(bond), type(uint256).max);
        bond.depositBond(address(token), AMOUNT);
        vm.stopPrank();

        token.mint(staker, AMOUNT);
        vm.startPrank(staker);
        token.approve(address(sm), type(uint256).max);
        sm.stake(address(token), AMOUNT);
        vm.stopPrank();
    }

    // --- slash bond ---

    function test_Slash_RoutesBondToTreasury() public {
        vm.expectEmit(true, true, true, true);
        emit Slashed(supplier, 400e6, REASON, address(treasury));
        vm.prank(slasher);
        controller.slash(supplier, 400e6, REASON);

        assertEq(bond.bondOf(supplier), 600e6);
        assertEq(treasury.balanceOf(address(token)), 400e6);
        // No funds get stranded in the controller.
        assertEq(token.balanceOf(address(controller)), 0);
    }

    function test_Slash_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.SLASHER_ROLE
            )
        );
        controller.slash(supplier, 100e6, REASON);
    }

    function test_Slash_RevertsZeroAmount() public {
        vm.prank(slasher);
        vm.expectRevert(ISlashingController.ZeroAmount.selector);
        controller.slash(supplier, 0, REASON);
    }

    function test_Slash_RevertsZeroWho() public {
        vm.prank(slasher);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        controller.slash(address(0), 100e6, REASON);
    }

    function test_Slash_RevertsNothingToSlash() public {
        vm.prank(slasher);
        vm.expectRevert(abi.encodeWithSelector(SlashingController.NothingToSlash.selector, stranger));
        controller.slash(stranger, 100e6, REASON);
    }

    // --- slash stake ---

    function test_SlashStake_RoutesStakeToTreasury() public {
        vm.expectEmit(true, true, true, true);
        emit StakeSlashed(staker, 250e6, REASON, address(treasury));
        vm.prank(slasher);
        controller.slashStake(staker, 250e6, REASON);

        assertEq(sm.stakeOf(staker), 750e6);
        assertEq(treasury.balanceOf(address(token)), 250e6);
        assertEq(token.balanceOf(address(controller)), 0);
    }

    function test_SlashStake_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.SLASHER_ROLE
            )
        );
        controller.slashStake(staker, 100e6, REASON);
    }

    function test_SlashStake_RevertsNothingToSlash() public {
        vm.prank(slasher);
        vm.expectRevert(abi.encodeWithSelector(SlashingController.NothingToSlash.selector, stranger));
        controller.slashStake(stranger, 100e6, REASON);
    }

    function test_Slash_RevertsUnknownPeer() public {
        // A controller pointed at an empty AddressBook cannot resolve SupplierBond.
        vm.startPrank(admin);
        AddressBook empty = new AddressBook(admin);
        SlashingController orphan = new SlashingController(address(empty), admin);
        orphan.grantRole(Roles.SLASHER_ROLE, slasher);
        vm.stopPrank();

        vm.prank(slasher);
        vm.expectRevert(abi.encodeWithSelector(IAddressBook.AddressNotFound.selector, Keys.SUPPLIER_BOND));
        orphan.slash(supplier, 100e6, REASON);
    }
}
