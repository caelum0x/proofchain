// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { SafetyTrainingRegistry } from "../../src/workforce/SafetyTrainingRegistry.sol";
import { ISafetyTrainingRegistry } from "../../src/interfaces/ISafetyTrainingRegistry.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract SafetyTrainingRegistryTest is Test {
    AddressBook internal book;
    SafetyTrainingRegistry internal reg;

    address internal admin = address(0xA11CE);
    address internal certifier = address(0xCE47);
    address internal provider = address(0x9707);
    address internal worker = address(0x0BADBEEF);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant COURSE = keccak256("fire-safety");
    bytes32 internal constant TITLE = bytes32("Fire Safety L1");
    bytes32 internal constant EVIDENCE = keccak256("cert.pdf");
    uint32 internal constant VALIDITY = 365;

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        reg = new SafetyTrainingRegistry(address(book), admin);
        reg.grantRole(Roles.CERTIFIER_ROLE, certifier);
        vm.stopPrank();
    }

    function _register() internal {
        vm.prank(certifier);
        reg.registerCourse(COURSE, TITLE, VALIDITY, provider);
    }

    function test_Register_Happy() public {
        _register();
        ISafetyTrainingRegistry.Course memory c = reg.courseOf(COURSE);
        assertEq(c.provider, provider);
        assertEq(c.validityDays, VALIDITY);
        assertTrue(c.active);
    }

    function test_Revert_Register_NotCertifier() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CERTIFIER_ROLE
            )
        );
        reg.registerCourse(COURSE, TITLE, VALIDITY, provider);
    }

    function test_Revert_Register_ZeroProvider() public {
        vm.prank(certifier);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        reg.registerCourse(COURSE, TITLE, VALIDITY, address(0));
    }

    function test_Revert_Register_Exists() public {
        _register();
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(ISafetyTrainingRegistry.CourseExists.selector, COURSE));
        reg.registerCourse(COURSE, TITLE, VALIDITY, provider);
    }

    function test_RecordCompletion_ByProvider() public {
        _register();
        vm.prank(provider);
        reg.recordCompletion(COURSE, worker, EVIDENCE);
        assertTrue(reg.isCurrent(COURSE, worker));

        ISafetyTrainingRegistry.Completion memory comp = reg.completionOf(COURSE, worker);
        assertEq(comp.evidenceHash, EVIDENCE);
        assertEq(comp.expiresAt, comp.completedAt + uint64(VALIDITY) * 1 days);
    }

    function test_RecordCompletion_ByCertifier() public {
        _register();
        vm.prank(certifier);
        reg.recordCompletion(COURSE, worker, EVIDENCE);
        assertTrue(reg.isCurrent(COURSE, worker));
    }

    function test_RecordCompletion_NeverExpiresWhenZeroValidity() public {
        vm.prank(certifier);
        reg.registerCourse(COURSE, TITLE, 0, provider);
        vm.prank(provider);
        reg.recordCompletion(COURSE, worker, EVIDENCE);
        assertEq(reg.completionOf(COURSE, worker).expiresAt, type(uint64).max);
        vm.warp(block.timestamp + 3650 days);
        assertTrue(reg.isCurrent(COURSE, worker));
    }

    function test_IsCurrent_FalseAfterExpiry() public {
        _register();
        vm.prank(provider);
        reg.recordCompletion(COURSE, worker, EVIDENCE);
        vm.warp(block.timestamp + uint64(VALIDITY) * 1 days + 1);
        assertFalse(reg.isCurrent(COURSE, worker));
    }

    function test_Revert_Record_ZeroWorker() public {
        _register();
        vm.prank(provider);
        vm.expectRevert(SafetyTrainingRegistry.ZeroWorker.selector);
        reg.recordCompletion(COURSE, address(0), EVIDENCE);
    }

    function test_Revert_Record_UnknownCourse() public {
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(ISafetyTrainingRegistry.UnknownCourse.selector, COURSE));
        reg.recordCompletion(COURSE, worker, EVIDENCE);
    }

    function test_Revert_Record_NotProvider() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISafetyTrainingRegistry.NotProvider.selector, COURSE));
        reg.recordCompletion(COURSE, worker, EVIDENCE);
    }

    function test_Revert_Record_InactiveCourse() public {
        _register();
        vm.prank(provider);
        reg.deactivateCourse(COURSE);
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(ISafetyTrainingRegistry.CourseInactive.selector, COURSE));
        reg.recordCompletion(COURSE, worker, EVIDENCE);
    }

    function test_Deactivate_ByProvider() public {
        _register();
        vm.prank(provider);
        reg.deactivateCourse(COURSE);
        assertFalse(reg.courseOf(COURSE).active);
    }

    function test_Revert_Deactivate_AlreadyInactive() public {
        _register();
        vm.startPrank(provider);
        reg.deactivateCourse(COURSE);
        vm.expectRevert(abi.encodeWithSelector(ISafetyTrainingRegistry.CourseInactive.selector, COURSE));
        reg.deactivateCourse(COURSE);
        vm.stopPrank();
    }

    function test_RevokeCompletion_Happy() public {
        _register();
        vm.prank(provider);
        reg.recordCompletion(COURSE, worker, EVIDENCE);
        vm.prank(provider);
        reg.revokeCompletion(COURSE, worker, bytes32("forged"));
        assertFalse(reg.isCurrent(COURSE, worker));
    }

    function test_Revert_Revoke_NoCompletion() public {
        _register();
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(ISafetyTrainingRegistry.NoCompletion.selector, COURSE, worker));
        reg.revokeCompletion(COURSE, worker, bytes32("x"));
    }

    function test_Revert_Revoke_AlreadyRevoked() public {
        _register();
        vm.startPrank(provider);
        reg.recordCompletion(COURSE, worker, EVIDENCE);
        reg.revokeCompletion(COURSE, worker, bytes32("x"));
        vm.expectRevert(abi.encodeWithSelector(ISafetyTrainingRegistry.AlreadyRevoked.selector, COURSE, worker));
        reg.revokeCompletion(COURSE, worker, bytes32("x"));
        vm.stopPrank();
    }
}
