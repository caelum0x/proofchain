// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { SkillAttestation } from "../../src/workforce/SkillAttestation.sol";
import { ISkillAttestation } from "../../src/interfaces/ISkillAttestation.sol";

contract SkillAttestationTest is Test {
    AddressBook internal book;
    SkillAttestation internal sa;

    address internal admin = address(0xA11CE);
    address internal certifier = address(0xCE47);
    address internal worker = address(0x0BADBEEF);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant ATT = keccak256("att-1");
    bytes32 internal constant ATT2 = keccak256("att-2");
    bytes32 internal constant SKILL = bytes32("welding");
    bytes32 internal constant FRAMEWORK = bytes32("ISO-9606");
    bytes32 internal constant EVIDENCE = keccak256("portfolio");

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        sa = new SkillAttestation(address(book), admin);
        sa.grantRole(Roles.CERTIFIER_ROLE, certifier);
        vm.stopPrank();
    }

    function _attest(bytes32 id, uint8 level, uint64 expiresAt) internal {
        vm.prank(certifier);
        sa.attest(id, worker, SKILL, FRAMEWORK, level, EVIDENCE, expiresAt);
    }

    function test_Attest_Happy() public {
        _attest(ATT, 4, 0);
        assertTrue(sa.hasSkill(worker, SKILL, 4));
        assertTrue(sa.hasSkill(worker, SKILL, 1));
        assertFalse(sa.hasSkill(worker, SKILL, 5));

        ISkillAttestation.Attestation memory a = sa.attestationOf(ATT);
        assertEq(a.worker, worker);
        assertEq(a.attester, certifier);
        assertEq(a.level, 4);
        assertFalse(a.revoked);
    }

    function test_Revert_Attest_NotCertifier() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CERTIFIER_ROLE
            )
        );
        sa.attest(ATT, worker, SKILL, FRAMEWORK, 3, EVIDENCE, 0);
    }

    function test_Revert_Attest_ZeroWorker() public {
        vm.prank(certifier);
        vm.expectRevert(ISkillAttestation.ZeroWorker.selector);
        sa.attest(ATT, address(0), SKILL, FRAMEWORK, 3, EVIDENCE, 0);
    }

    function test_Revert_Attest_InvalidLevelZero() public {
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(ISkillAttestation.InvalidLevel.selector, uint8(0)));
        sa.attest(ATT, worker, SKILL, FRAMEWORK, 0, EVIDENCE, 0);
    }

    function test_Revert_Attest_InvalidLevelTooHigh() public {
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(ISkillAttestation.InvalidLevel.selector, uint8(6)));
        sa.attest(ATT, worker, SKILL, FRAMEWORK, 6, EVIDENCE, 0);
    }

    function test_Revert_Attest_Exists() public {
        _attest(ATT, 3, 0);
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(ISkillAttestation.AttestationExists.selector, ATT));
        sa.attest(ATT, worker, SKILL, FRAMEWORK, 3, EVIDENCE, 0);
    }

    function test_Revoke_Happy() public {
        _attest(ATT, 4, 0);
        vm.prank(certifier);
        sa.revoke(ATT, bytes32("fraud"));
        assertFalse(sa.hasSkill(worker, SKILL, 1));
        assertTrue(sa.attestationOf(ATT).revoked);
    }

    function test_Revert_Revoke_Unknown() public {
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(ISkillAttestation.UnknownAttestation.selector, ATT));
        sa.revoke(ATT, bytes32("x"));
    }

    function test_Revert_Revoke_AlreadyRevoked() public {
        _attest(ATT, 4, 0);
        vm.startPrank(certifier);
        sa.revoke(ATT, bytes32("x"));
        vm.expectRevert(abi.encodeWithSelector(ISkillAttestation.AlreadyRevoked.selector, ATT));
        sa.revoke(ATT, bytes32("x"));
        vm.stopPrank();
    }

    function test_Revert_Revoke_NotAttester() public {
        _attest(ATT, 4, 0);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISkillAttestation.NotAttester.selector, ATT));
        sa.revoke(ATT, bytes32("x"));
    }

    function test_HasSkill_FalseAfterExpiry() public {
        uint64 exp = uint64(block.timestamp + 30 days);
        _attest(ATT, 4, exp);
        assertTrue(sa.hasSkill(worker, SKILL, 4));
        vm.warp(exp + 1);
        assertFalse(sa.hasSkill(worker, SKILL, 4));
    }

    function test_LatestSupersedes() public {
        _attest(ATT, 5, 0);
        assertTrue(sa.hasSkill(worker, SKILL, 5));
        // A newer, lower-level attestation for the same skill supersedes the old one.
        _attest(ATT2, 3, 0);
        assertFalse(sa.hasSkill(worker, SKILL, 4));
        assertTrue(sa.hasSkill(worker, SKILL, 3));
    }
}
