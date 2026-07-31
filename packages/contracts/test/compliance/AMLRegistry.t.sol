// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { AMLRegistry } from "../../src/compliance/AMLRegistry.sol";
import { SanctionsScreening } from "../../src/compliance/SanctionsScreening.sol";
import { IAMLRegistry } from "../../src/interfaces/IAMLRegistry.sol";
import { ISanctionsScreening } from "../../src/interfaces/ISanctionsScreening.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract AMLRegistryTest is Test {
    AddressBook internal book;
    AMLRegistry internal aml;
    SanctionsScreening internal sanctions;

    address internal admin = address(0xA11CE);
    address internal officer = address(0x0FF1CE);
    address internal subject = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant SAR_ID = keccak256("sar-1");
    bytes32 internal constant EVIDENCE = keccak256("evidence");

    event RiskRated(address indexed account, IAMLRegistry.RiskRating rating, bytes32 evidenceHash);
    event SARFiled(bytes32 indexed sarId, address indexed subject, bytes32 detailsHash);
    event SARResolved(bytes32 indexed sarId, bool escalated);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        aml = new AMLRegistry(address(book), admin);
        sanctions = new SanctionsScreening(address(book), admin);
        book.setAddress(Keys.SANCTIONS_SCREENING, address(sanctions));
        aml.grantRole(Roles.COMPLIANCE_OFFICER_ROLE, officer);
        vm.stopPrank();
    }

    function test_SetRisk_Happy() public {
        vm.expectEmit(true, false, false, true);
        emit RiskRated(subject, IAMLRegistry.RiskRating.Medium, EVIDENCE);
        vm.prank(officer);
        aml.setRisk(subject, IAMLRegistry.RiskRating.Medium, EVIDENCE);

        assertEq(uint8(aml.riskOf(subject)), uint8(IAMLRegistry.RiskRating.Medium));
        assertFalse(aml.isHighRisk(subject));
    }

    function test_HighRisk_ByRating() public {
        vm.prank(officer);
        aml.setRisk(subject, IAMLRegistry.RiskRating.High, EVIDENCE);
        assertTrue(aml.isHighRisk(subject));
    }

    function test_HighRisk_BySanctions() public {
        // Low risk locally, but sanctioned -> folded signal makes it high risk.
        vm.prank(officer);
        aml.setRisk(subject, IAMLRegistry.RiskRating.Low, EVIDENCE);
        assertFalse(aml.isHighRisk(subject));

        vm.prank(admin);
        sanctions.listAddress(subject, ISanctionsScreening.ListSource.OFAC, EVIDENCE);
        assertTrue(aml.isHighRisk(subject));
    }

    function test_FileAndResolveSAR() public {
        vm.startPrank(officer);
        vm.expectEmit(true, true, false, true);
        emit SARFiled(SAR_ID, subject, EVIDENCE);
        aml.fileSAR(SAR_ID, subject, EVIDENCE);

        assertEq(aml.profileOf(subject).openSARs, 1);
        assertTrue(aml.isHighRisk(subject)); // open SAR => high risk

        vm.expectEmit(true, false, false, true);
        emit SARResolved(SAR_ID, false);
        aml.resolveSAR(SAR_ID, false);
        vm.stopPrank();

        assertEq(aml.profileOf(subject).openSARs, 0);
        assertFalse(aml.isHighRisk(subject));
    }

    function test_ResolveSAR_Escalated_SetsProhibited() public {
        vm.startPrank(officer);
        aml.fileSAR(SAR_ID, subject, EVIDENCE);
        aml.resolveSAR(SAR_ID, true);
        vm.stopPrank();

        assertEq(uint8(aml.riskOf(subject)), uint8(IAMLRegistry.RiskRating.Prohibited));
        assertTrue(aml.isHighRisk(subject));
    }

    function test_Revert_SetRisk_Unrated() public {
        vm.prank(officer);
        vm.expectRevert(IAMLRegistry.InvalidRating.selector);
        aml.setRisk(subject, IAMLRegistry.RiskRating.Unrated, EVIDENCE);
    }

    function test_Revert_SetRisk_ZeroAddress() public {
        vm.prank(officer);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        aml.setRisk(address(0), IAMLRegistry.RiskRating.Low, EVIDENCE);
    }

    function test_Revert_FileSAR_Exists() public {
        vm.startPrank(officer);
        aml.fileSAR(SAR_ID, subject, EVIDENCE);
        vm.expectRevert(abi.encodeWithSelector(IAMLRegistry.SARExists.selector, SAR_ID));
        aml.fileSAR(SAR_ID, subject, EVIDENCE);
        vm.stopPrank();
    }

    function test_Revert_ResolveSAR_Unknown() public {
        vm.prank(officer);
        vm.expectRevert(abi.encodeWithSelector(IAMLRegistry.UnknownSAR.selector, SAR_ID));
        aml.resolveSAR(SAR_ID, false);
    }

    function test_Revert_ResolveSAR_AlreadyResolved() public {
        vm.startPrank(officer);
        aml.fileSAR(SAR_ID, subject, EVIDENCE);
        aml.resolveSAR(SAR_ID, false);
        vm.expectRevert(abi.encodeWithSelector(IAMLRegistry.UnknownSAR.selector, SAR_ID));
        aml.resolveSAR(SAR_ID, false);
        vm.stopPrank();
    }

    function test_Revert_SetRisk_AccessControl() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.COMPLIANCE_OFFICER_ROLE
            )
        );
        aml.setRisk(subject, IAMLRegistry.RiskRating.Low, EVIDENCE);
    }
}
