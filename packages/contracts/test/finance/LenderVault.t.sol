// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { LenderVault } from "../../src/finance/LenderVault.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockDeployedPool } from "./mocks/MockDeployedPool.sol";

contract LenderVaultTest is Test {
    AddressBook internal book;
    LenderVault internal vault;
    MockUSDC internal usdc;
    MockDeployedPool internal pool;

    address internal admin = address(0xA11CE);
    address internal alice = address(0xA11);
    address internal borrower = address(0xB0410);
    address internal stranger = address(0xDEAD);

    uint256 internal constant DEPOSIT = 1_000e6;

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        usdc = new MockUSDC();
        vault = new LenderVault(address(book), admin, address(usdc));
        pool = new MockDeployedPool();
        book.setAddress(Keys.FINANCING_POOL, address(pool));
        vm.stopPrank();

        usdc.mint(alice, DEPOSIT);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _deposit() internal returns (uint256 shares) {
        vm.prank(alice);
        shares = vault.deposit(DEPOSIT, alice);
    }

    function test_Deposit_MintsShares() public {
        uint256 shares = _deposit();
        assertEq(shares, DEPOSIT); // 1:1 on first deposit
        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalAssets(), DEPOSIT);
        assertEq(vault.asset(), address(usdc));
    }

    function test_TotalAssets_CountsDeployedCapital() public {
        _deposit();
        // Pool borrows 400 from the vault; NAV must be unchanged (idle down, deployed up).
        vm.prank(address(pool));
        vault.lendTo(borrower, 400e6);
        pool.setDeployed(400e6);

        assertEq(usdc.balanceOf(address(vault)), 600e6);
        assertEq(vault.totalAssets(), DEPOSIT);
    }

    function test_YieldLiftsSharePrice() public {
        uint256 shares = _deposit();

        // Deploy 400, earn 50 yield, return principal, mark repaid.
        vm.prank(address(pool));
        vault.lendTo(borrower, 400e6);
        pool.setDeployed(400e6);

        usdc.mint(address(vault), 50e6); // yield paid into vault
        vm.prank(borrower);
        usdc.transfer(address(vault), 400e6); // principal returned
        pool.setDeployed(0);

        assertEq(vault.totalAssets(), DEPOSIT + 50e6);

        vm.prank(alice);
        uint256 assets = vault.redeem(shares, alice, alice);
        // Depositor captured the yield (approx: ERC4626 virtual shares round down by <=1 wei).
        assertApproxEqAbs(assets, DEPOSIT + 50e6, 2);
    }

    function test_Convert_RoundTrip() public {
        _deposit();
        uint256 s = vault.convertToShares(100e6);
        uint256 a = vault.convertToAssets(s);
        assertApproxEqAbs(a, 100e6, 1);
    }

    // --- lendTo access & validation ---

    function test_Revert_LendTo_NotPool() public {
        _deposit();
        vm.prank(stranger);
        vm.expectRevert(LenderVault.NotPool.selector);
        vault.lendTo(borrower, 1e6);
    }

    function test_Revert_LendTo_ZeroAmount() public {
        _deposit();
        vm.prank(address(pool));
        vm.expectRevert(LenderVault.ZeroAmount.selector);
        vault.lendTo(borrower, 0);
    }

    function test_Revert_LendTo_ZeroAddress() public {
        _deposit();
        vm.prank(address(pool));
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        vault.lendTo(address(0), 1e6);
    }

    function test_Revert_Constructor_ZeroAsset() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new LenderVault(address(book), admin, address(0));
    }
}
