// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { HalalCertification } from "../../src/compliance/HalalCertification.sol";
import { IHalalCertification } from "../../src/interfaces/IHalalCertification.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract HalalCertificationTest is Test {
    AddressBook internal book;
    HalalCertification internal halal;

    address internal admin = address(0xA11CE);
    address internal certifier = address(0xCE47);
    address internal producer = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant CERT = keccak256("cert-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant STANDARD = bytes32("MS1500");
    bytes32 internal constant DOC = keccak256("doc");
    uint64 internal expiry;

    event Issued(
        bytes32 indexed certId, bytes32 indexed batchId, bytes32 standard, address indexed certifier, uint64 expiry
    );
    event Suspended(bytes32 indexed certId, string reason);
    event Reinstated(bytes32 indexed certId);
    event Revoked(bytes32 indexed certId, string reason);

    function setUp() public {
        expiry = uint64(block.timestamp + 365 days);
        vm.startPrank(admin);
        book = new AddressBook(admin);
        halal = new HalalCertification(address(book), admin);
        halal.grantRole(Roles.CERTIFIER_ROLE, certifier);
        vm.stopPrank();
    }

    function _issue() internal {
        vm.prank(certifier);
        halal.issue(CERT, BATCH, STANDARD, producer, DOC, expiry);
    }

    function test_Issue_Happy() public {
        vm.expectEmit(true, true, true, true);
        emit Issued(CERT, BATCH, STANDARD, certifier, expiry);
        _issue();

        assertTrue(halal.isValid(CERT));
        IHalalCertification.Certificate memory c = halal.certificateOf(CERT);
        assertEq(uint8(c.status), uint8(IHalalCertification.CertStatus.Active));
        assertEq(c.producer, producer);
    }

    function test_SuspendReinstate() public {
        _issue();
        vm.startPrank(certifier);
        vm.expectEmit(true, false, false, true);
        emit Suspended(CERT, "re-audit");
        halal.suspend(CERT, "re-audit");
        assertFalse(halal.isValid(CERT));

        vm.expectEmit(true, false, false, false);
        emit Reinstated(CERT);
        halal.reinstate(CERT);
        vm.stopPrank();
        assertTrue(halal.isValid(CERT));
    }

    function test_Revoke_FromActive() public {
        _issue();
        vm.prank(certifier);
        halal.revoke(CERT, "fraud");
        assertFalse(halal.isValid(CERT));
        assertEq(uint8(halal.certificateOf(CERT).status), uint8(IHalalCertification.CertStatus.Revoked));
    }

    function test_Revoke_FromSuspended() public {
        _issue();
        vm.startPrank(certifier);
        halal.suspend(CERT, "x");
        halal.revoke(CERT, "y");
        vm.stopPrank();
        assertEq(uint8(halal.certificateOf(CERT).status), uint8(IHalalCertification.CertStatus.Revoked));
    }

    function test_IsValid_FalseWhenExpired() public {
        _issue();
        vm.warp(expiry + 1);
        assertFalse(halal.isValid(CERT));
    }

    function test_Revert_Issue_CertExists() public {
        _issue();
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(IHalalCertification.CertExists.selector, CERT));
        halal.issue(CERT, BATCH, STANDARD, producer, DOC, expiry);
    }

    function test_Revert_Issue_ZeroProducer() public {
        vm.prank(certifier);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        halal.issue(CERT, BATCH, STANDARD, address(0), DOC, expiry);
    }

    function test_Revert_Issue_PastExpiry() public {
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(IHalalCertification.PastExpiry.selector, uint64(block.timestamp)));
        halal.issue(CERT, BATCH, STANDARD, producer, DOC, uint64(block.timestamp));
    }

    function test_Revert_Suspend_NotActive() public {
        _issue();
        vm.startPrank(certifier);
        halal.suspend(CERT, "x");
        vm.expectRevert(
            abi.encodeWithSelector(
                IHalalCertification.InvalidStatus.selector,
                CERT,
                IHalalCertification.CertStatus.Active,
                IHalalCertification.CertStatus.Suspended
            )
        );
        halal.suspend(CERT, "x");
        vm.stopPrank();
    }

    function test_Revert_Reinstate_NotSuspended() public {
        _issue();
        vm.prank(certifier);
        vm.expectRevert(
            abi.encodeWithSelector(
                IHalalCertification.InvalidStatus.selector,
                CERT,
                IHalalCertification.CertStatus.Suspended,
                IHalalCertification.CertStatus.Active
            )
        );
        halal.reinstate(CERT);
    }

    function test_Revert_Revoke_Unknown() public {
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(IHalalCertification.UnknownCert.selector, CERT));
        halal.revoke(CERT, "x");
    }

    function test_Revert_Issue_AccessControl() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CERTIFIER_ROLE
            )
        );
        halal.issue(CERT, BATCH, STANDARD, producer, DOC, expiry);
    }
}
