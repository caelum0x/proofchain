// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { Roles } from "../../src/core/Roles.sol";
import { WaterCredit } from "../../src/energy/WaterCredit.sol";
import { IWaterCredit } from "../../src/interfaces/IWaterCredit.sol";

contract WaterCreditTest is Test {
    AddressBook internal book;
    WaterCredit internal wc;

    address internal admin = address(0xA11CE);
    address internal certifier = address(0xC0DE);
    address internal minter = address(0x515E);
    address internal steward = address(0x57E);
    address internal alice = address(0xA71CE);
    address internal bob = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant PROJECT = keccak256("basin-restore-1");
    bytes32 internal constant BASIN = keccak256("colorado");
    bytes32 internal constant METHOD = keccak256("vwba-v1");
    bytes32 internal constant BENEFICIARY = keccak256("acme");

    event ProjectRegistered(bytes32 indexed projectId, address indexed steward, bytes32 basin, bytes32 methodology);
    event CreditsIssued(bytes32 indexed projectId, address indexed to, uint256 amount);
    event CreditsRetired(bytes32 indexed projectId, address indexed account, uint256 amount, bytes32 beneficiary);

    function setUp() public {
        book = new AddressBook(admin);
        wc = new WaterCredit(address(book), admin);
        vm.startPrank(admin);
        wc.grantRole(Roles.CERTIFIER_ROLE, certifier);
        wc.grantRole(Roles.MINTER_ROLE, minter);
        vm.stopPrank();
    }

    function _register() internal {
        vm.prank(certifier);
        wc.registerProject(PROJECT, steward, BASIN, METHOD);
    }

    function _verify() internal {
        _register();
        vm.prank(certifier);
        wc.verifyProject(PROJECT);
    }

    function _issue(address to, uint256 amount) internal {
        vm.prank(minter);
        wc.issue(PROJECT, to, amount);
    }

    // ------------------------------------------------------------- register / verify / suspend

    function test_Register_Happy() public {
        vm.expectEmit(true, true, false, true, address(wc));
        emit ProjectRegistered(PROJECT, steward, BASIN, METHOD);
        _register();
        IWaterCredit.Project memory p = wc.projectOf(PROJECT);
        assertEq(p.steward, steward);
        assertEq(uint8(p.state), uint8(IWaterCredit.ProjectState.Registered));
    }

    function test_Revert_Register_ZeroSteward() public {
        vm.prank(certifier);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        wc.registerProject(PROJECT, address(0), BASIN, METHOD);
    }

    function test_Revert_Register_Exists() public {
        _register();
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(IWaterCredit.ProjectExists.selector, PROJECT));
        wc.registerProject(PROJECT, steward, BASIN, METHOD);
    }

    function test_Revert_Register_NotCertifier() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CERTIFIER_ROLE)
        );
        wc.registerProject(PROJECT, steward, BASIN, METHOD);
    }

    function test_Verify_Happy() public {
        _verify();
        assertEq(uint8(wc.projectOf(PROJECT).state), uint8(IWaterCredit.ProjectState.Verified));
    }

    function test_Revert_Verify_WrongState() public {
        _verify();
        vm.prank(certifier);
        vm.expectRevert(
            abi.encodeWithSelector(
                IWaterCredit.InvalidState.selector, PROJECT, IWaterCredit.ProjectState.Registered, IWaterCredit.ProjectState.Verified
            )
        );
        wc.verifyProject(PROJECT);
    }

    function test_Suspend_BlocksIssuance() public {
        _verify();
        vm.prank(certifier);
        wc.suspendProject(PROJECT, keccak256("fraud"));
        assertEq(uint8(wc.projectOf(PROJECT).state), uint8(IWaterCredit.ProjectState.Suspended));

        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                IWaterCredit.InvalidState.selector, PROJECT, IWaterCredit.ProjectState.Verified, IWaterCredit.ProjectState.Suspended
            )
        );
        wc.issue(PROJECT, alice, 100);
    }

    // ------------------------------------------------------------- issue

    function test_Issue_Happy() public {
        _verify();
        vm.expectEmit(true, true, false, true, address(wc));
        emit CreditsIssued(PROJECT, alice, 1000);
        _issue(alice, 1000);
        assertEq(wc.balanceOf(PROJECT, alice), 1000);
        assertEq(wc.projectOf(PROJECT).issued, 1000);
    }

    function test_Revert_Issue_NotVerified() public {
        _register();
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                IWaterCredit.InvalidState.selector, PROJECT, IWaterCredit.ProjectState.Verified, IWaterCredit.ProjectState.Registered
            )
        );
        wc.issue(PROJECT, alice, 1000);
    }

    function test_Revert_Issue_NotMinter() public {
        _verify();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.MINTER_ROLE)
        );
        wc.issue(PROJECT, alice, 1000);
    }

    function test_Revert_Issue_ZeroAmount() public {
        _verify();
        vm.prank(minter);
        vm.expectRevert(IWaterCredit.ZeroAmount.selector);
        wc.issue(PROJECT, alice, 0);
    }

    // ------------------------------------------------------------- transfer

    function test_Transfer_Happy() public {
        _verify();
        _issue(alice, 1000);
        vm.prank(alice);
        wc.transfer(PROJECT, bob, 400);
        assertEq(wc.balanceOf(PROJECT, alice), 600);
        assertEq(wc.balanceOf(PROJECT, bob), 400);
    }

    function test_Revert_Transfer_Insufficient() public {
        _verify();
        _issue(alice, 100);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IWaterCredit.InsufficientCredits.selector, PROJECT, alice, 200, 100));
        wc.transfer(PROJECT, bob, 200);
    }

    // ------------------------------------------------------------- retire

    function test_Retire_Happy() public {
        _verify();
        _issue(alice, 1000);
        vm.expectEmit(true, true, false, true, address(wc));
        emit CreditsRetired(PROJECT, alice, 300, BENEFICIARY);
        vm.prank(alice);
        wc.retire(PROJECT, 300, BENEFICIARY);
        assertEq(wc.balanceOf(PROJECT, alice), 700);
        assertEq(wc.projectOf(PROJECT).retired, 300);
    }

    function test_Retire_AllowedWhenSuspended() public {
        _verify();
        _issue(alice, 1000);
        vm.prank(certifier);
        wc.suspendProject(PROJECT, keccak256("reversal"));
        // Holders may still retire even when a project is suspended.
        vm.prank(alice);
        wc.retire(PROJECT, 500, BENEFICIARY);
        assertEq(wc.projectOf(PROJECT).retired, 500);
    }

    function test_Revert_Retire_Insufficient() public {
        _verify();
        _issue(alice, 100);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IWaterCredit.InsufficientCredits.selector, PROJECT, alice, 200, 100));
        wc.retire(PROJECT, 200, BENEFICIARY);
    }

    function test_Revert_Retire_UnknownProject() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IWaterCredit.UnknownProject.selector, PROJECT));
        wc.retire(PROJECT, 100, BENEFICIARY);
    }

    function test_Revert_ProjectOf_Unknown() public {
        vm.expectRevert(abi.encodeWithSelector(IWaterCredit.UnknownProject.selector, PROJECT));
        wc.projectOf(PROJECT);
    }
}
