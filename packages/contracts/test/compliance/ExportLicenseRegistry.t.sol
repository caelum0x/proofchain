// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ExportLicenseRegistry } from "../../src/compliance/ExportLicenseRegistry.sol";
import { IExportLicenseRegistry } from "../../src/interfaces/IExportLicenseRegistry.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract ExportLicenseRegistryTest is Test {
    AddressBook internal book;
    ExportLicenseRegistry internal licenses;

    address internal admin = address(0xA11CE);
    address internal officer = address(0x0FF1CE);
    address internal exporter = address(0xE0);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant LIC = keccak256("lic-1");
    bytes32 internal constant COMMODITY = bytes32("8471");
    bytes32 internal constant DEST = bytes32("SG");
    uint64 internal expiry;

    event Granted(
        bytes32 indexed licenseId,
        address indexed exporter,
        bytes32 indexed commodityCode,
        bytes32 destinationCountry,
        uint256 quantityCap,
        uint64 expiry
    );
    event Drawn(bytes32 indexed licenseId, uint256 quantity, uint256 totalUsed);

    function setUp() public {
        expiry = uint64(block.timestamp + 365 days);
        vm.startPrank(admin);
        book = new AddressBook(admin);
        licenses = new ExportLicenseRegistry(address(book), admin);
        licenses.grantRole(Roles.COMPLIANCE_OFFICER_ROLE, officer);
        vm.stopPrank();
    }

    function _grant() internal {
        vm.prank(officer);
        licenses.grant(LIC, exporter, COMMODITY, DEST, 1000, expiry);
    }

    function test_Grant_Happy() public {
        vm.expectEmit(true, true, true, true);
        emit Granted(LIC, exporter, COMMODITY, DEST, 1000, expiry);
        _grant();

        assertTrue(licenses.isValid(LIC));
        IExportLicenseRegistry.License memory l = licenses.licenseOf(LIC);
        assertEq(l.authority, officer);
        assertEq(l.quantityCap, 1000);
        assertEq(uint8(l.state), uint8(IExportLicenseRegistry.LicenseState.Active));
    }

    function test_Draw_PartialAndExhaust() public {
        _grant();
        vm.startPrank(officer);
        vm.expectEmit(true, false, false, true);
        emit Drawn(LIC, 600, 600);
        licenses.draw(LIC, 600);
        assertTrue(licenses.isValid(LIC));

        licenses.draw(LIC, 400);
        vm.stopPrank();

        assertFalse(licenses.isValid(LIC));
        assertEq(uint8(licenses.licenseOf(LIC).state), uint8(IExportLicenseRegistry.LicenseState.Exhausted));
    }

    function test_SuspendReinstate() public {
        _grant();
        vm.startPrank(officer);
        licenses.suspend(LIC, "review");
        assertFalse(licenses.isValid(LIC));
        licenses.reinstate(LIC);
        vm.stopPrank();
        assertTrue(licenses.isValid(LIC));
    }

    function test_Revoke() public {
        _grant();
        vm.prank(officer);
        licenses.revoke(LIC, "violation");
        assertFalse(licenses.isValid(LIC));
        assertEq(uint8(licenses.licenseOf(LIC).state), uint8(IExportLicenseRegistry.LicenseState.Revoked));
    }

    function test_Revert_Grant_Exists() public {
        _grant();
        vm.prank(officer);
        vm.expectRevert(abi.encodeWithSelector(IExportLicenseRegistry.LicenseExists.selector, LIC));
        licenses.grant(LIC, exporter, COMMODITY, DEST, 1000, expiry);
    }

    function test_Revert_Grant_ZeroQuantity() public {
        vm.prank(officer);
        vm.expectRevert(IExportLicenseRegistry.ZeroQuantity.selector);
        licenses.grant(LIC, exporter, COMMODITY, DEST, 0, expiry);
    }

    function test_Revert_Grant_ZeroExporter() public {
        vm.prank(officer);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        licenses.grant(LIC, address(0), COMMODITY, DEST, 1000, expiry);
    }

    function test_Revert_Grant_PastExpiry() public {
        vm.prank(officer);
        vm.expectRevert(abi.encodeWithSelector(IExportLicenseRegistry.PastExpiry.selector, uint64(block.timestamp)));
        licenses.grant(LIC, exporter, COMMODITY, DEST, 1000, uint64(block.timestamp));
    }

    function test_Revert_Draw_CapExceeded() public {
        _grant();
        vm.prank(officer);
        vm.expectRevert(abi.encodeWithSelector(IExportLicenseRegistry.CapExceeded.selector, 1001, 1000));
        licenses.draw(LIC, 1001);
    }

    function test_Revert_Draw_Unknown() public {
        vm.prank(officer);
        vm.expectRevert(abi.encodeWithSelector(IExportLicenseRegistry.UnknownLicense.selector, LIC));
        licenses.draw(LIC, 1);
    }

    function test_Revert_Suspend_NotAuthority() public {
        _grant();
        // admin has COMPLIANCE_OFFICER_ROLE but is not the granting authority (officer was).
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IExportLicenseRegistry.NotAuthority.selector, LIC));
        licenses.suspend(LIC, "x");
    }

    function test_Revert_Reinstate_NotSuspended() public {
        _grant();
        vm.prank(officer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IExportLicenseRegistry.InvalidState.selector,
                LIC,
                IExportLicenseRegistry.LicenseState.Suspended,
                IExportLicenseRegistry.LicenseState.Active
            )
        );
        licenses.reinstate(LIC);
    }

    function test_Revert_Grant_AccessControl() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.COMPLIANCE_OFFICER_ROLE
            )
        );
        licenses.grant(LIC, exporter, COMMODITY, DEST, 1000, expiry);
    }
}
