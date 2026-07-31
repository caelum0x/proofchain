// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { DigitalProductPassport } from "../../src/dpp/DigitalProductPassport.sol";
import { DPPComplianceOracle } from "../../src/dpp/DPPComplianceOracle.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IDPPComplianceOracle } from "../../src/interfaces/IDPPComplianceOracle.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract DPPComplianceOracleTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    DigitalProductPassport internal dpp;
    DPPComplianceOracle internal oracle;

    address internal admin = address(0xA11CE);
    address internal manufacturer = address(0xBEEF);
    address internal governor = address(0x6060);
    address internal agent = address(0xA6E7);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ESPR = keccak256("ESPR");
    uint32 internal constant REQUIRED = 0x7; // flags 0,1,2 required
    uint16 internal constant MIN_SCORE = 7000;
    uint256 internal tokenId;

    event ProfileConfigured(bytes32 indexed regulationProfile, uint32 requiredFlags, uint16 minScore);
    event Evaluated(uint256 indexed tokenId, bytes32 indexed regulationProfile, uint16 score, IDPPComplianceOracle.Verdict verdict);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        dpp = new DigitalProductPassport(address(book), admin);
        oracle = new DPPComplianceOracle(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        book.setAddress(Keys.DIGITAL_PRODUCT_PASSPORT, address(dpp));
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerBatch(BATCH, keccak256("origin"), "ipfs://m");
        tokenId = dpp.issue(BATCH, keccak256("gtin"), manufacturer, "ipfs://doc");
        oracle.grantRole(Roles.GOVERNOR_ROLE, governor);
        oracle.grantRole(Roles.AGENT_ROLE, agent);
        vm.stopPrank();
    }

    function _configure() internal {
        vm.prank(governor);
        oracle.configureProfile(ESPR, REQUIRED, MIN_SCORE);
    }

    function test_ConfigureProfile() public {
        vm.expectEmit(true, false, false, true, address(oracle));
        emit ProfileConfigured(ESPR, REQUIRED, MIN_SCORE);
        _configure();
    }

    function test_Evaluate_Compliant() public {
        _configure();
        vm.expectEmit(true, true, false, true, address(oracle));
        emit Evaluated(tokenId, ESPR, 8500, IDPPComplianceOracle.Verdict.Compliant);
        vm.prank(agent);
        IDPPComplianceOracle.Verdict v = oracle.evaluate(tokenId, ESPR, 8500, 0x7, keccak256("ev"));
        assertEq(uint8(v), uint8(IDPPComplianceOracle.Verdict.Compliant));
        assertTrue(oracle.isCompliant(tokenId, ESPR));

        IDPPComplianceOracle.ComplianceReport memory r = oracle.reportOf(tokenId, ESPR);
        assertEq(r.score, 8500);
        assertEq(r.satisfiedFlags, 0x7);
        assertEq(r.requiredFlags, REQUIRED);
    }

    function test_Evaluate_Conditional_WhenScoreBelowMin() public {
        _configure();
        // All flags satisfied but score below minimum => Conditional.
        vm.prank(agent);
        IDPPComplianceOracle.Verdict v = oracle.evaluate(tokenId, ESPR, 5000, 0x7, keccak256("ev"));
        assertEq(uint8(v), uint8(IDPPComplianceOracle.Verdict.Conditional));
        assertFalse(oracle.isCompliant(tokenId, ESPR));
    }

    function test_Evaluate_NonCompliant_WhenMissingFlag() public {
        _configure();
        // Missing required flag 2 (0x4) => NonCompliant regardless of high score.
        vm.prank(agent);
        IDPPComplianceOracle.Verdict v = oracle.evaluate(tokenId, ESPR, 9500, 0x3, keccak256("ev"));
        assertEq(uint8(v), uint8(IDPPComplianceOracle.Verdict.NonCompliant));
    }

    function test_Evaluate_OverwritesPrevious() public {
        _configure();
        vm.startPrank(agent);
        oracle.evaluate(tokenId, ESPR, 5000, 0x7, keccak256("ev1"));
        oracle.evaluate(tokenId, ESPR, 9000, 0x7, keccak256("ev2"));
        vm.stopPrank();
        assertTrue(oracle.isCompliant(tokenId, ESPR));
        assertEq(oracle.reportOf(tokenId, ESPR).score, 9000);
    }

    function test_RevertWhen_ConfigureZeroProfile() public {
        vm.prank(governor);
        vm.expectRevert(abi.encodeWithSelector(IDPPComplianceOracle.UnknownProfile.selector, bytes32(0)));
        oracle.configureProfile(bytes32(0), REQUIRED, MIN_SCORE);
    }

    function test_RevertWhen_ConfigureScoreOutOfRange() public {
        vm.prank(governor);
        vm.expectRevert(abi.encodeWithSelector(IDPPComplianceOracle.ScoreOutOfRange.selector, uint16(10001)));
        oracle.configureProfile(ESPR, REQUIRED, 10001);
    }

    function test_RevertWhen_NonGovernorConfigures() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.GOVERNOR_ROLE)
        );
        oracle.configureProfile(ESPR, REQUIRED, MIN_SCORE);
    }

    function test_RevertWhen_EvaluateUnknownProfile() public {
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IDPPComplianceOracle.UnknownProfile.selector, ESPR));
        oracle.evaluate(tokenId, ESPR, 8000, 0x7, keccak256("ev"));
    }

    function test_RevertWhen_EvaluateScoreOutOfRange() public {
        _configure();
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IDPPComplianceOracle.ScoreOutOfRange.selector, uint16(10001)));
        oracle.evaluate(tokenId, ESPR, 10001, 0x7, keccak256("ev"));
    }

    function test_RevertWhen_EvaluateUnknownPassport() public {
        _configure();
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IDPPComplianceOracle.UnknownPassport.selector, uint256(99)));
        oracle.evaluate(99, ESPR, 8000, 0x7, keccak256("ev"));
    }

    function test_RevertWhen_NonAgentEvaluates() public {
        _configure();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.AGENT_ROLE)
        );
        oracle.evaluate(tokenId, ESPR, 8000, 0x7, keccak256("ev"));
    }
}
