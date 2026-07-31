// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { PhytosanitaryCertificate } from "../../src/compliance/PhytosanitaryCertificate.sol";
import { IPhytosanitaryCertificate } from "../../src/interfaces/IPhytosanitaryCertificate.sol";

contract PhytosanitaryCertificateTest is Test {
    AddressBook internal book;
    PhytosanitaryCertificate internal phyto;

    address internal admin = address(0xA11CE);
    address internal certifier = address(0xCE47);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant CERT = keccak256("cert-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = bytes32("KE");
    bytes32 internal constant DEST = bytes32("NL");
    bytes32 internal constant PLANT = bytes32("Rosa");
    bytes32 internal constant DOC = keccak256("doc");
    uint64 internal expiry;

    event Issued(
        bytes32 indexed certId,
        bytes32 indexed batchId,
        bytes32 originCountry,
        bytes32 destinationCountry,
        IPhytosanitaryCertificate.TreatmentType treatment,
        uint64 expiry
    );

    function setUp() public {
        expiry = uint64(block.timestamp + 90 days);
        vm.startPrank(admin);
        book = new AddressBook(admin);
        phyto = new PhytosanitaryCertificate(address(book), admin);
        phyto.grantRole(Roles.CERTIFIER_ROLE, certifier);
        vm.stopPrank();
    }

    function _issue() internal {
        vm.prank(certifier);
        phyto.issue(
            CERT, BATCH, ORIGIN, DEST, PLANT, IPhytosanitaryCertificate.TreatmentType.Fumigation, DOC, expiry
        );
    }

    function test_Issue_Happy() public {
        vm.expectEmit(true, true, false, true);
        emit Issued(CERT, BATCH, ORIGIN, DEST, IPhytosanitaryCertificate.TreatmentType.Fumigation, expiry);
        _issue();

        assertTrue(phyto.isValid(CERT));
        IPhytosanitaryCertificate.Certificate memory c = phyto.certificateOf(CERT);
        assertEq(uint8(c.treatment), uint8(IPhytosanitaryCertificate.TreatmentType.Fumigation));
        assertEq(c.botanicalName, PLANT);
        assertEq(c.issuer, certifier);
    }

    function test_Revoke_Happy() public {
        _issue();
        vm.prank(certifier);
        phyto.revoke(CERT, "pest-interception");
        assertFalse(phyto.isValid(CERT));
    }

    function test_IsValid_FalseWhenExpired() public {
        _issue();
        vm.warp(expiry + 1);
        assertFalse(phyto.isValid(CERT));
    }

    function test_Revert_Issue_CertExists() public {
        _issue();
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(IPhytosanitaryCertificate.CertExists.selector, CERT));
        phyto.issue(CERT, BATCH, ORIGIN, DEST, PLANT, IPhytosanitaryCertificate.TreatmentType.None, DOC, expiry);
    }

    function test_Revert_Issue_PastExpiry() public {
        vm.prank(certifier);
        vm.expectRevert(
            abi.encodeWithSelector(IPhytosanitaryCertificate.PastExpiry.selector, uint64(block.timestamp))
        );
        phyto.issue(
            CERT, BATCH, ORIGIN, DEST, PLANT, IPhytosanitaryCertificate.TreatmentType.None, DOC, uint64(block.timestamp)
        );
    }

    function test_Revert_Revoke_Unknown() public {
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(IPhytosanitaryCertificate.UnknownCert.selector, CERT));
        phyto.revoke(CERT, "x");
    }

    function test_Revert_Revoke_AlreadyRevoked() public {
        _issue();
        vm.startPrank(certifier);
        phyto.revoke(CERT, "x");
        vm.expectRevert(abi.encodeWithSelector(IPhytosanitaryCertificate.AlreadyRevoked.selector, CERT));
        phyto.revoke(CERT, "x");
        vm.stopPrank();
    }

    function test_Revert_Issue_AccessControl() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CERTIFIER_ROLE
            )
        );
        phyto.issue(CERT, BATCH, ORIGIN, DEST, PLANT, IPhytosanitaryCertificate.TreatmentType.None, DOC, expiry);
    }
}
