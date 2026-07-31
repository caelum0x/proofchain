// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { Roles } from "../../src/core/Roles.sol";
import { BiodiversityCredit } from "../../src/energy/BiodiversityCredit.sol";
import { IBiodiversityCredit } from "../../src/interfaces/IBiodiversityCredit.sol";

contract BiodiversityCreditTest is Test {
    AddressBook internal book;
    BiodiversityCredit internal bc;

    address internal admin = address(0xA11CE);
    address internal certifier = address(0xC0DE);
    address internal minter = address(0x515E);
    address internal steward = address(0x57E);
    address internal alice = address(0xA71CE);
    address internal bob = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant PROJECT = keccak256("wetland-1");
    bytes32 internal constant HABITAT = keccak256("wetland");
    bytes32 internal constant GEOHASH = keccak256("gcpuvpk");
    bytes32 internal constant METHOD = keccak256("bng-v4");
    bytes32 internal constant BENEFICIARY = keccak256("acme");
    uint32 internal constant AREA = 250;

    event ProjectRegistered(
        bytes32 indexed projectId, address indexed steward, bytes32 habitat, bytes32 methodology, uint32 areaHectares
    );
    event ProjectVerified(bytes32 indexed projectId, uint256 baselineScore, uint256 upliftScore);
    event CreditsIssued(bytes32 indexed projectId, address indexed to, uint256 amount);

    function setUp() public {
        book = new AddressBook(admin);
        bc = new BiodiversityCredit(address(book), admin);
        vm.startPrank(admin);
        bc.grantRole(Roles.CERTIFIER_ROLE, certifier);
        bc.grantRole(Roles.MINTER_ROLE, minter);
        vm.stopPrank();
    }

    function _register() internal {
        vm.prank(certifier);
        bc.registerProject(PROJECT, steward, HABITAT, GEOHASH, METHOD, AREA);
    }

    function _verify(uint256 baseline, uint256 uplift) internal {
        _register();
        vm.prank(certifier);
        bc.verifyProject(PROJECT, baseline, uplift);
    }

    // ------------------------------------------------------------- register

    function test_Register_Happy() public {
        vm.expectEmit(true, true, false, true, address(bc));
        emit ProjectRegistered(PROJECT, steward, HABITAT, METHOD, AREA);
        _register();
        IBiodiversityCredit.Project memory p = bc.projectOf(PROJECT);
        assertEq(p.steward, steward);
        assertEq(p.areaHectares, AREA);
        assertEq(uint8(p.state), uint8(IBiodiversityCredit.ProjectState.Registered));
    }

    function test_Revert_Register_ZeroArea() public {
        vm.prank(certifier);
        vm.expectRevert(IBiodiversityCredit.ZeroArea.selector);
        bc.registerProject(PROJECT, steward, HABITAT, GEOHASH, METHOD, 0);
    }

    function test_Revert_Register_ZeroSteward() public {
        vm.prank(certifier);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        bc.registerProject(PROJECT, address(0), HABITAT, GEOHASH, METHOD, AREA);
    }

    function test_Revert_Register_Exists() public {
        _register();
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(IBiodiversityCredit.ProjectExists.selector, PROJECT));
        bc.registerProject(PROJECT, steward, HABITAT, GEOHASH, METHOD, AREA);
    }

    // ------------------------------------------------------------- verify

    function test_Verify_Happy() public {
        _register();
        vm.expectEmit(true, false, false, true, address(bc));
        emit ProjectVerified(PROJECT, 100, 800);
        vm.prank(certifier);
        bc.verifyProject(PROJECT, 100, 800);
        assertEq(uint8(bc.projectOf(PROJECT).state), uint8(IBiodiversityCredit.ProjectState.Verified));
        (uint256 baseline, uint256 uplift) = bc.scoresOf(PROJECT);
        assertEq(baseline, 100);
        assertEq(uplift, 800);
    }

    function test_Revert_Verify_ZeroUplift() public {
        _register();
        vm.prank(certifier);
        vm.expectRevert(IBiodiversityCredit.ZeroAmount.selector);
        bc.verifyProject(PROJECT, 100, 0);
    }

    // ------------------------------------------------------------- issue (uplift cap)

    function test_Issue_Happy() public {
        _verify(100, 800);
        vm.expectEmit(true, true, false, true, address(bc));
        emit CreditsIssued(PROJECT, alice, 500);
        vm.prank(minter);
        bc.issue(PROJECT, alice, 500);
        assertEq(bc.balanceOf(PROJECT, alice), 500);
        assertEq(bc.projectOf(PROJECT).issued, 500);
    }

    function test_Revert_Issue_ExceedsUplift() public {
        _verify(100, 800);
        vm.startPrank(minter);
        bc.issue(PROJECT, alice, 600);
        vm.expectRevert(abi.encodeWithSelector(IBiodiversityCredit.UpliftExceeded.selector, PROJECT, 300, 200));
        bc.issue(PROJECT, alice, 300);
        vm.stopPrank();
    }

    function test_Revert_Issue_NotVerified() public {
        _register();
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                IBiodiversityCredit.InvalidState.selector,
                PROJECT,
                IBiodiversityCredit.ProjectState.Verified,
                IBiodiversityCredit.ProjectState.Registered
            )
        );
        bc.issue(PROJECT, alice, 100);
    }

    // ------------------------------------------------------------- transfer / retire

    function test_Transfer_Happy() public {
        _verify(100, 800);
        vm.prank(minter);
        bc.issue(PROJECT, alice, 500);
        vm.prank(alice);
        bc.transfer(PROJECT, bob, 200);
        assertEq(bc.balanceOf(PROJECT, alice), 300);
        assertEq(bc.balanceOf(PROJECT, bob), 200);
    }

    function test_Retire_Happy() public {
        _verify(100, 800);
        vm.prank(minter);
        bc.issue(PROJECT, alice, 500);
        vm.prank(alice);
        bc.retire(PROJECT, 200, BENEFICIARY);
        assertEq(bc.balanceOf(PROJECT, alice), 300);
        assertEq(bc.projectOf(PROJECT).retired, 200);
    }

    function test_Revert_Retire_Insufficient() public {
        _verify(100, 800);
        vm.prank(minter);
        bc.issue(PROJECT, alice, 100);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IBiodiversityCredit.InsufficientCredits.selector, PROJECT, alice, 200, 100));
        bc.retire(PROJECT, 200, BENEFICIARY);
    }

    function test_Revert_ScoresOf_Unknown() public {
        vm.expectRevert(abi.encodeWithSelector(IBiodiversityCredit.UnknownProject.selector, PROJECT));
        bc.scoresOf(PROJECT);
    }
}
