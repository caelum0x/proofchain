// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { CertificateOfOrigin } from "../../src/compliance/CertificateOfOrigin.sol";
import { ICertificateOfOrigin } from "../../src/interfaces/ICertificateOfOrigin.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract CertificateOfOriginTest is Test {
    AddressBook internal book;
    CertificateOfOrigin internal coo;

    address internal admin = address(0xA11CE);
    address internal certifier = address(0xCE47);
    address internal exporter = address(0xE0);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant CERT = keccak256("cert-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant COUNTRY = bytes32("DE");
    bytes32 internal constant DOC = keccak256("doc");
    uint64 internal expiry;

    event Issued(
        bytes32 indexed certId,
        bytes32 indexed batchId,
        bytes32 indexed originCountry,
        ICertificateOfOrigin.OriginType originType,
        address issuer,
        uint64 expiry
    );
    event Revoked(bytes32 indexed certId, string reason);

    function setUp() public {
        expiry = uint64(block.timestamp + 365 days);
        vm.startPrank(admin);
        book = new AddressBook(admin);
        coo = new CertificateOfOrigin(address(book), admin);
        coo.grantRole(Roles.CERTIFIER_ROLE, certifier);
        vm.stopPrank();
    }

    function _issue() internal {
        vm.prank(certifier);
        coo.issue(CERT, BATCH, COUNTRY, ICertificateOfOrigin.OriginType.Preferential, exporter, DOC, expiry);
    }

    function test_Issue_Happy() public {
        vm.expectEmit(true, true, true, true);
        emit Issued(CERT, BATCH, COUNTRY, ICertificateOfOrigin.OriginType.Preferential, certifier, expiry);
        _issue();

        assertTrue(coo.isValid(CERT));
        assertEq(coo.originOf(BATCH), COUNTRY);
        ICertificateOfOrigin.Certificate memory c = coo.certificateOf(CERT);
        assertEq(c.exporter, exporter);
        assertEq(c.issuer, certifier);
        assertFalse(c.revoked);
    }

    function test_Revoke_Happy() public {
        _issue();
        vm.expectEmit(true, false, false, true);
        emit Revoked(CERT, "fraud");
        vm.prank(certifier);
        coo.revoke(CERT, "fraud");

        assertFalse(coo.isValid(CERT));
        assertEq(coo.originOf(BATCH), bytes32(0));
    }

    function test_OriginOf_ZeroWhenExpired() public {
        _issue();
        vm.warp(expiry + 1);
        assertFalse(coo.isValid(CERT));
        assertEq(coo.originOf(BATCH), bytes32(0));
    }

    function test_Revert_Issue_CertExists() public {
        _issue();
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(ICertificateOfOrigin.CertExists.selector, CERT));
        coo.issue(CERT, BATCH, COUNTRY, ICertificateOfOrigin.OriginType.NonPreferential, exporter, DOC, expiry);
    }

    function test_Revert_Issue_ZeroCountry() public {
        vm.prank(certifier);
        vm.expectRevert(ICertificateOfOrigin.ZeroCountry.selector);
        coo.issue(CERT, BATCH, bytes32(0), ICertificateOfOrigin.OriginType.Preferential, exporter, DOC, expiry);
    }

    function test_Revert_Issue_ZeroExporter() public {
        vm.prank(certifier);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        coo.issue(CERT, BATCH, COUNTRY, ICertificateOfOrigin.OriginType.Preferential, address(0), DOC, expiry);
    }

    function test_Revert_Issue_PastExpiry() public {
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(ICertificateOfOrigin.PastExpiry.selector, uint64(block.timestamp)));
        coo.issue(
            CERT, BATCH, COUNTRY, ICertificateOfOrigin.OriginType.Preferential, exporter, DOC, uint64(block.timestamp)
        );
    }

    function test_Revert_Revoke_Unknown() public {
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(ICertificateOfOrigin.UnknownCert.selector, CERT));
        coo.revoke(CERT, "x");
    }

    function test_Revert_Revoke_AlreadyRevoked() public {
        _issue();
        vm.startPrank(certifier);
        coo.revoke(CERT, "x");
        vm.expectRevert(abi.encodeWithSelector(ICertificateOfOrigin.AlreadyRevoked.selector, CERT));
        coo.revoke(CERT, "x");
        vm.stopPrank();
    }

    function test_Revert_Issue_AccessControl() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CERTIFIER_ROLE
            )
        );
        coo.issue(CERT, BATCH, COUNTRY, ICertificateOfOrigin.OriginType.Preferential, exporter, DOC, expiry);
    }
}
