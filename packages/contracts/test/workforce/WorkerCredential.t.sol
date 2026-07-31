// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { WorkerCredential } from "../../src/workforce/WorkerCredential.sol";
import { IWorkerCredential } from "../../src/interfaces/IWorkerCredential.sol";

contract WorkerCredentialTest is Test {
    AddressBook internal book;
    WorkerCredential internal wc;

    address internal admin = address(0xA11CE);
    address internal certifier = address(0xCE47);
    address internal worker = address(0x0BADBEEF);
    address internal other = address(0x0FF1CE);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant COMMIT = keccak256("id-commit");
    bytes32 internal constant ROLE = bytes32("electrician");
    uint64 internal expiry;

    function setUp() public {
        expiry = uint64(block.timestamp + 365 days);
        vm.startPrank(admin);
        book = new AddressBook(admin);
        wc = new WorkerCredential(address(book), admin);
        wc.grantRole(Roles.CERTIFIER_ROLE, certifier);
        vm.stopPrank();
    }

    function _issue() internal returns (uint256) {
        vm.prank(certifier);
        return wc.issue(worker, COMMIT, ROLE, expiry);
    }

    function test_Issue_Happy() public {
        uint256 id = _issue();
        assertEq(id, 1);
        assertTrue(wc.isActive(worker));
        assertEq(wc.credentialOfWorker(worker), id);
        assertEq(wc.ownerOf(id), worker);
        assertEq(wc.balanceOf(worker), 1);

        IWorkerCredential.Credential memory c = wc.credentialOf(id);
        assertEq(c.worker, worker);
        assertEq(c.issuer, certifier);
        assertEq(c.identityCommit, COMMIT);
        assertEq(uint8(c.status), uint8(IWorkerCredential.CredentialStatus.Active));
    }

    function test_Revert_Issue_NotCertifier() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CERTIFIER_ROLE
            )
        );
        wc.issue(worker, COMMIT, ROLE, expiry);
    }

    function test_Revert_Issue_ZeroWorker() public {
        vm.prank(certifier);
        vm.expectRevert(IWorkerCredential.ZeroWorker.selector);
        wc.issue(address(0), COMMIT, ROLE, expiry);
    }

    function test_Revert_Issue_Duplicate() public {
        _issue();
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(IWorkerCredential.WorkerCredentialExists.selector, worker));
        wc.issue(worker, COMMIT, ROLE, expiry);
    }

    function test_Revert_Issue_PastExpiry() public {
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(WorkerCredential.InvalidExpiry.selector, uint64(block.timestamp)));
        wc.issue(worker, COMMIT, ROLE, uint64(block.timestamp));
    }

    function test_Revert_Soulbound_Transfer() public {
        uint256 id = _issue();
        vm.prank(worker);
        vm.expectRevert(IWorkerCredential.Soulbound.selector);
        wc.transferFrom(worker, other, id);
    }

    function test_Revert_Soulbound_SafeTransfer() public {
        uint256 id = _issue();
        vm.prank(worker);
        vm.expectRevert(IWorkerCredential.Soulbound.selector);
        wc.safeTransferFrom(worker, other, id);
    }

    function test_SetStatus_SuspendReactivateRevoke() public {
        uint256 id = _issue();

        vm.prank(certifier);
        wc.setStatus(id, IWorkerCredential.CredentialStatus.Suspended);
        assertFalse(wc.isActive(worker));

        vm.prank(certifier);
        wc.setStatus(id, IWorkerCredential.CredentialStatus.Active);
        assertTrue(wc.isActive(worker));

        vm.prank(certifier);
        wc.setStatus(id, IWorkerCredential.CredentialStatus.Revoked);
        assertFalse(wc.isActive(worker));
        // token stays owned by worker (soulbound revocation is a status flag, not a burn)
        assertEq(wc.ownerOf(id), worker);
    }

    function test_Revert_SetStatus_InvalidTransition() public {
        uint256 id = _issue();
        // Active -> Active is not a legal transition.
        vm.prank(certifier);
        vm.expectRevert(
            abi.encodeWithSelector(
                IWorkerCredential.InvalidStatusTransition.selector,
                id,
                IWorkerCredential.CredentialStatus.Active,
                IWorkerCredential.CredentialStatus.Active
            )
        );
        wc.setStatus(id, IWorkerCredential.CredentialStatus.Active);
    }

    function test_Revert_SetStatus_RevokedIsTerminal() public {
        uint256 id = _issue();
        vm.startPrank(certifier);
        wc.setStatus(id, IWorkerCredential.CredentialStatus.Revoked);
        vm.expectRevert(
            abi.encodeWithSelector(
                IWorkerCredential.InvalidStatusTransition.selector,
                id,
                IWorkerCredential.CredentialStatus.Revoked,
                IWorkerCredential.CredentialStatus.Suspended
            )
        );
        wc.setStatus(id, IWorkerCredential.CredentialStatus.Suspended);
        vm.stopPrank();
    }

    function test_Revert_SetStatus_NotIssuer() public {
        uint256 id = _issue();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IWorkerCredential.NotIssuer.selector, id));
        wc.setStatus(id, IWorkerCredential.CredentialStatus.Suspended);
    }

    function test_Revert_SetStatus_Unknown() public {
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(IWorkerCredential.UnknownCredential.selector, uint256(99)));
        wc.setStatus(99, IWorkerCredential.CredentialStatus.Suspended);
    }

    function test_Renew_ExtendsExpiry() public {
        uint256 id = _issue();
        uint64 newExpiry = expiry + 30 days;
        vm.prank(certifier);
        wc.renew(id, newExpiry);
        assertEq(wc.credentialOf(id).expiresAt, newExpiry);
    }

    function test_Revert_Renew_PastOrEarlier() public {
        uint256 id = _issue();
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(WorkerCredential.InvalidExpiry.selector, expiry));
        wc.renew(id, expiry); // not strictly greater than current
    }

    function test_Revert_Renew_Revoked() public {
        uint256 id = _issue();
        vm.startPrank(certifier);
        wc.setStatus(id, IWorkerCredential.CredentialStatus.Revoked);
        vm.expectRevert(
            abi.encodeWithSelector(
                IWorkerCredential.InvalidStatusTransition.selector,
                id,
                IWorkerCredential.CredentialStatus.Revoked,
                IWorkerCredential.CredentialStatus.Active
            )
        );
        wc.renew(id, expiry + 30 days);
        vm.stopPrank();
    }

    function test_IsActive_FalseWhenExpired() public {
        _issue();
        vm.warp(expiry + 1);
        assertFalse(wc.isActive(worker));
    }

    function test_SupportsInterface() public view {
        assertTrue(wc.supportsInterface(type(IERC721).interfaceId));
        assertTrue(wc.supportsInterface(type(IAccessControl).interfaceId));
    }
}
