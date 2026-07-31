// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { Roles } from "../../src/core/Roles.sol";
import { TrancheToken } from "../../src/tradefinance/TrancheToken.sol";
import { ITrancheToken } from "../../src/interfaces/ITrancheToken.sol";

contract TrancheTokenTest is Test {
    TrancheToken internal tt;

    address internal admin = address(0xA11CE);
    address internal minter = address(0x312E12); // the securitization contract
    address internal investor = address(0x1);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant POOL = keccak256("pool-1");
    uint16 internal constant SENIORITY = 0;

    function setUp() public {
        tt = new TrancheToken("ProofChain Senior", "PCS", POOL, SENIORITY, admin, minter);
    }

    function test_Metadata() public view {
        assertEq(tt.name(), "ProofChain Senior");
        assertEq(tt.symbol(), "PCS");
        assertEq(tt.poolId(), POOL);
        assertEq(tt.seniority(), SENIORITY);
    }

    function test_Mint_ByMinter() public {
        vm.prank(minter);
        tt.mint(investor, 1_000e18);
        assertEq(tt.balanceOf(investor), 1_000e18);
        assertEq(tt.totalSupply(), 1_000e18);
    }

    function test_Revert_Mint_NotMinter() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.MINTER_ROLE)
        );
        tt.mint(investor, 1_000e18);
    }

    function test_Revert_Mint_ZeroAmount() public {
        vm.prank(minter);
        vm.expectRevert(ITrancheToken.ZeroAmount.selector);
        tt.mint(investor, 0);
    }

    function test_Burn_ByMinter() public {
        vm.startPrank(minter);
        tt.mint(investor, 1_000e18);
        tt.burn(investor, 400e18);
        vm.stopPrank();
        assertEq(tt.balanceOf(investor), 600e18);
    }

    function test_Revert_Burn_InsufficientBalance() public {
        vm.startPrank(minter);
        tt.mint(investor, 100e18);
        vm.expectRevert(abi.encodeWithSelector(ITrancheToken.InsufficientBalance.selector, investor, 200e18, 100e18));
        tt.burn(investor, 200e18);
        vm.stopPrank();
    }

    function test_Transfer_StandardERC20() public {
        vm.prank(minter);
        tt.mint(investor, 1_000e18);
        vm.prank(investor);
        tt.transfer(stranger, 250e18);
        assertEq(tt.balanceOf(stranger), 250e18);
        assertEq(tt.balanceOf(investor), 750e18);
    }
}
