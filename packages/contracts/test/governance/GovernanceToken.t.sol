// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { Roles } from "../../src/core/Roles.sol";
import { GovernanceToken } from "../../src/governance/GovernanceToken.sol";
import { IGovernanceToken } from "../../src/interfaces/IGovernanceToken.sol";

contract GovernanceTokenTest is Test {
    GovernanceToken internal token;

    address internal admin = address(0xA11CE);
    address internal minter = address(0x54217E);
    address internal alice = address(0xA11);
    address internal bob = address(0xB0B);

    event Minted(address indexed to, uint256 amount);

    function setUp() public {
        token = new GovernanceToken(admin, minter);
    }

    // --- construction ---

    function test_Constructor_SetsMetadataAndRoles() public view {
        assertEq(token.name(), "ProofChain Governance");
        assertEq(token.symbol(), "PROOF");
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(token.hasRole(Roles.MINTER_ROLE, minter));
    }

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(IGovernanceToken.ZeroAddress.selector);
        new GovernanceToken(address(0), minter);
        vm.expectRevert(IGovernanceToken.ZeroAddress.selector);
        new GovernanceToken(admin, address(0));
    }

    // --- mint ---

    function test_Mint_HappyPath() public {
        vm.expectEmit(true, false, false, true);
        emit Minted(alice, 1000e18);
        vm.prank(minter);
        token.mint(alice, 1000e18);

        assertEq(token.balanceOf(alice), 1000e18);
        assertEq(token.totalSupply(), 1000e18);
    }

    function test_Mint_RevertsWhenNotMinter() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, Roles.MINTER_ROLE)
        );
        vm.prank(alice);
        token.mint(alice, 1000e18);
    }

    function test_Mint_RevertsZeroAddress() public {
        vm.prank(minter);
        vm.expectRevert(IGovernanceToken.ZeroAddress.selector);
        token.mint(address(0), 1000e18);
    }

    function test_Mint_RevertsZeroAmount() public {
        vm.prank(minter);
        vm.expectRevert(IGovernanceToken.ZeroAmount.selector);
        token.mint(alice, 0);
    }

    // --- voting power (ERC20Votes) ---

    function test_Votes_NoPowerUntilDelegated() public {
        vm.prank(minter);
        token.mint(alice, 1000e18);
        // Balance alone confers no voting power until self-delegation.
        assertEq(token.getVotes(alice), 0);

        vm.prank(alice);
        token.delegate(alice);
        assertEq(token.getVotes(alice), 1000e18);
    }

    function test_Votes_TransferMovesVotingPower() public {
        vm.prank(minter);
        token.mint(alice, 1000e18);
        vm.prank(alice);
        token.delegate(alice);
        vm.prank(bob);
        token.delegate(bob);

        vm.prank(alice);
        token.transfer(bob, 400e18);

        assertEq(token.getVotes(alice), 600e18);
        assertEq(token.getVotes(bob), 400e18);
    }

    function test_Votes_PastVotesCheckpointed() public {
        vm.prank(minter);
        token.mint(alice, 1000e18);
        vm.prank(alice);
        token.delegate(alice);

        vm.roll(block.number + 1);
        uint256 checkpointBlock = block.number - 1;

        vm.prank(minter);
        token.mint(alice, 500e18); // alice auto-recheckpoints via delegation

        vm.roll(block.number + 1);
        assertEq(token.getPastVotes(alice, checkpointBlock), 1000e18);
        assertEq(token.getVotes(alice), 1500e18);
    }

    function test_Nonces_StartAtZero() public view {
        assertEq(token.nonces(alice), 0);
    }
}
