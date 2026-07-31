// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { TradeComplianceEngine } from "../../src/compliance/TradeComplianceEngine.sol";
import { SanctionsScreening } from "../../src/compliance/SanctionsScreening.sol";
import { AMLRegistry } from "../../src/compliance/AMLRegistry.sol";
import { ExportLicenseRegistry } from "../../src/compliance/ExportLicenseRegistry.sol";
import { CertificateOfOrigin } from "../../src/compliance/CertificateOfOrigin.sol";
import { CustomsDeclaration } from "../../src/compliance/CustomsDeclaration.sol";
import { DutyAndTariffCalculator } from "../../src/compliance/DutyAndTariffCalculator.sol";
import { Treasury } from "../../src/payments/Treasury.sol";
import { StablecoinRegistry } from "../../src/payments/StablecoinRegistry.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { ITradeComplianceEngine } from "../../src/interfaces/ITradeComplianceEngine.sol";
import { ISanctionsScreening } from "../../src/interfaces/ISanctionsScreening.sol";
import { ICertificateOfOrigin } from "../../src/interfaces/ICertificateOfOrigin.sol";
import { IAMLRegistry } from "../../src/interfaces/IAMLRegistry.sol";

contract TradeComplianceEngineTest is Test {
    AddressBook internal book;
    TradeComplianceEngine internal engine;
    SanctionsScreening internal sanctions;
    AMLRegistry internal aml;
    ExportLicenseRegistry internal licenses;
    CertificateOfOrigin internal coo;
    CustomsDeclaration internal customs;
    DutyAndTariffCalculator internal calc;
    Treasury internal treasury;
    StablecoinRegistry internal registry;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal exporter = address(0xE0);
    address internal importer = address(0x1);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant DEST = bytes32("DE");
    bytes32 internal constant ORIGIN = bytes32("JP");
    bytes32 internal constant HS = bytes32("8703");
    bytes32 internal constant LIC = keccak256("lic-1");
    bytes32 internal constant CERT = keccak256("cert-1");
    bytes32 internal constant DECL = keccak256("decl-1");

    uint32 internal constant FLAG_SANCTIONS = 1 << 0;
    uint32 internal constant FLAG_ALL = 31; // sanctions|aml|license|certificate|customs

    uint256 internal constant VALUE = 1_000e6;
    uint256 internal constant DUTY = 100e6;

    event Evaluated(bytes32 indexed batchId, ITradeComplianceEngine.Decision decision, uint32 failedFlags);
    event Overridden(bytes32 indexed batchId, ITradeComplianceEngine.Decision decision, string reason);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        engine = new TradeComplianceEngine(address(book), admin);
        sanctions = new SanctionsScreening(address(book), admin);
        aml = new AMLRegistry(address(book), admin);
        licenses = new ExportLicenseRegistry(address(book), admin);
        coo = new CertificateOfOrigin(address(book), admin);
        customs = new CustomsDeclaration(address(book), admin);
        calc = new DutyAndTariffCalculator(address(book), admin);
        treasury = new Treasury(address(book), admin);
        registry = new StablecoinRegistry(address(book), admin);
        usdc = new MockUSDC();

        book.setAddress(Keys.SANCTIONS_SCREENING, address(sanctions));
        book.setAddress(Keys.AML_REGISTRY, address(aml));
        book.setAddress(Keys.EXPORT_LICENSE_REGISTRY, address(licenses));
        book.setAddress(Keys.CERTIFICATE_OF_ORIGIN, address(coo));
        book.setAddress(Keys.CUSTOMS_DECLARATION, address(customs));
        book.setAddress(Keys.DUTY_AND_TARIFF_CALCULATOR, address(calc));
        book.setAddress(Keys.TREASURY, address(treasury));
        book.setAddress(Keys.STABLECOIN_REGISTRY, address(registry));

        registry.addToken(address(usdc), 6);
        calc.setRate(HS, ORIGIN, DEST, 1000, 0, 0, false);
        engine.setRequirements(DEST, FLAG_ALL);

        // Grant a valid export license and bind it to the batch.
        licenses.grant(LIC, exporter, bytes32("8703"), DEST, 1000, uint64(block.timestamp + 365 days));
        engine.bindLicense(BATCH, LIC);

        // Issue a valid certificate of origin for the batch.
        coo.issue(
            CERT, BATCH, ORIGIN, ICertificateOfOrigin.OriginType.Preferential, exporter, keccak256("doc"),
            uint64(block.timestamp + 365 days)
        );
        vm.stopPrank();

        // Push a customs declaration all the way to Released and bind it.
        usdc.mint(exporter, DUTY);
        vm.prank(exporter);
        usdc.approve(address(customs), type(uint256).max);
        vm.prank(exporter);
        customs.lodge(DECL, BATCH, HS, ORIGIN, DEST, VALUE, address(usdc));
        vm.startPrank(admin);
        customs.assess(DECL);
        vm.stopPrank();
        vm.prank(exporter);
        customs.payDuty(DECL);
        vm.startPrank(admin);
        customs.release(DECL);
        engine.bindDeclaration(BATCH, DECL);
        vm.stopPrank();
    }

    function test_Evaluate_Cleared_AllChecksPass() public {
        vm.expectEmit(true, false, false, true);
        emit Evaluated(BATCH, ITradeComplianceEngine.Decision.Cleared, 0);
        vm.prank(admin);
        ITradeComplianceEngine.Decision d = engine.evaluate(BATCH, exporter, importer, DEST);

        assertEq(uint8(d), uint8(ITradeComplianceEngine.Decision.Cleared));
        assertTrue(engine.isCleared(BATCH));
        ITradeComplianceEngine.Check memory c = engine.checkOf(BATCH);
        assertEq(c.failedFlags, 0);
        assertEq(c.exporter, exporter);
    }

    function test_Evaluate_Blocked_WhenExporterSanctioned() public {
        vm.prank(admin);
        sanctions.listAddress(exporter, ISanctionsScreening.ListSource.OFAC, keccak256("r"));

        vm.prank(admin);
        engine.evaluate(BATCH, exporter, importer, DEST);

        assertFalse(engine.isCleared(BATCH));
        ITradeComplianceEngine.Check memory c = engine.checkOf(BATCH);
        assertEq(uint8(c.decision), uint8(ITradeComplianceEngine.Decision.Blocked));
        assertTrue(c.failedFlags & FLAG_SANCTIONS != 0);
    }

    function test_Evaluate_Blocked_WhenImporterHighRisk() public {
        vm.prank(admin);
        aml.setRisk(importer, IAMLRegistry.RiskRating.Prohibited, keccak256("e"));

        vm.prank(admin);
        engine.evaluate(BATCH, exporter, importer, DEST);
        assertFalse(engine.isCleared(BATCH));
        assertTrue(engine.checkOf(BATCH).failedFlags & (1 << 1) != 0); // AML flag
    }

    function test_Evaluate_Blocked_WhenCertificateRevoked() public {
        vm.prank(admin);
        coo.revoke(CERT, "fraud");

        vm.prank(admin);
        engine.evaluate(BATCH, exporter, importer, DEST);
        assertFalse(engine.isCleared(BATCH));
        assertTrue(engine.checkOf(BATCH).failedFlags & (1 << 3) != 0); // certificate flag
    }

    function test_Evaluate_NoRequirements_AlwaysClears() public {
        bytes32 freeLane = bytes32("US");
        vm.prank(admin);
        ITradeComplianceEngine.Decision d = engine.evaluate(keccak256("b2"), exporter, importer, freeLane);
        assertEq(uint8(d), uint8(ITradeComplianceEngine.Decision.Cleared));
    }

    function test_Override() public {
        vm.startPrank(admin);
        sanctions.listAddress(exporter, ISanctionsScreening.ListSource.OFAC, keccak256("r"));
        engine.evaluate(BATCH, exporter, importer, DEST);
        assertFalse(engine.isCleared(BATCH));

        vm.expectEmit(true, false, false, true);
        emit Overridden(BATCH, ITradeComplianceEngine.Decision.Cleared, "manual-clearance");
        engine.override_(BATCH, ITradeComplianceEngine.Decision.Cleared, "manual-clearance");
        vm.stopPrank();
        assertTrue(engine.isCleared(BATCH));
    }

    function test_Revert_SetRequirements_ZeroCountry() public {
        vm.prank(admin);
        vm.expectRevert(ITradeComplianceEngine.ZeroCountry.selector);
        engine.setRequirements(bytes32(0), FLAG_ALL);
    }

    function test_Revert_Override_UnknownCheck() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ITradeComplianceEngine.UnknownCheck.selector, keccak256("nope")));
        engine.override_(keccak256("nope"), ITradeComplianceEngine.Decision.Cleared, "x");
    }

    function test_Revert_SetRequirements_AccessControl() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.COMPLIANCE_OFFICER_ROLE
            )
        );
        engine.setRequirements(DEST, FLAG_ALL);
    }

    function test_Revert_Override_AccessControl() public {
        vm.prank(admin);
        engine.evaluate(BATCH, exporter, importer, DEST);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.COMPLIANCE_OFFICER_ROLE
            )
        );
        engine.override_(BATCH, ITradeComplianceEngine.Decision.Cleared, "x");
    }
}
