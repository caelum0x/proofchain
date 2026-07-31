// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { DigitalProductPassport } from "../../src/dpp/DigitalProductPassport.sol";
import { RepairabilityIndex } from "../../src/dpp/RepairabilityIndex.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IRepairabilityIndex } from "../../src/interfaces/IRepairabilityIndex.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract RepairabilityIndexTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    DigitalProductPassport internal dpp;
    RepairabilityIndex internal repair;

    address internal admin = address(0xA11CE);
    address internal manufacturer = address(0xBEEF);
    address internal inspector = address(0x1435);
    address internal governor = address(0x6060);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    uint256 internal tokenId;

    event WeightsSet(uint16 documentationW, uint16 disassemblyW, uint16 spareAvailabilityW, uint16 sparePricingW, uint16 softwareSupportW);
    event ScoreSet(uint256 indexed tokenId, uint16 score, address indexed assessor);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        dpp = new DigitalProductPassport(address(book), admin);
        repair = new RepairabilityIndex(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        book.setAddress(Keys.DIGITAL_PRODUCT_PASSPORT, address(dpp));
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerBatch(BATCH, keccak256("origin"), "ipfs://m");
        tokenId = dpp.issue(BATCH, keccak256("gtin"), manufacturer, "ipfs://doc");
        repair.grantRole(Roles.INSPECTOR_ROLE, inspector);
        repair.grantRole(Roles.GOVERNOR_ROLE, governor);
        vm.stopPrank();
    }

    function test_DefaultWeightsEqual() public view {
        IRepairabilityIndex.Weights memory w = repair.weights();
        assertEq(w.documentationW, 2000);
        assertEq(w.softwareSupportW, 2000);
    }

    function test_Assess_ComputesWeightedScore() public {
        // Equal 20% weights, criteria: 8000,6000,10000,4000,2000
        // weighted = (8000+6000+10000+4000+2000)*2000/10000 = 30000*2000/10000 = 6000
        IRepairabilityIndex.Criteria memory c = IRepairabilityIndex.Criteria({
            documentation: 8000,
            disassembly: 6000,
            spareAvailability: 10000,
            sparePricing: 4000,
            softwareSupport: 2000
        });

        vm.expectEmit(true, false, true, true, address(repair));
        emit ScoreSet(tokenId, 6000, inspector);
        vm.prank(inspector);
        uint16 score = repair.assess(tokenId, c);
        assertEq(score, 6000);
        assertEq(repair.scoreOf(tokenId), 6000);

        IRepairabilityIndex.Criteria memory stored = repair.criteriaOf(tokenId);
        assertEq(stored.documentation, 8000);
    }

    function test_SetWeights_ChangesComputation() public {
        // Put all weight on documentation.
        IRepairabilityIndex.Weights memory w = IRepairabilityIndex.Weights({
            documentationW: 10000,
            disassemblyW: 0,
            spareAvailabilityW: 0,
            sparePricingW: 0,
            softwareSupportW: 0
        });
        vm.expectEmit(false, false, false, true, address(repair));
        emit WeightsSet(10000, 0, 0, 0, 0);
        vm.prank(governor);
        repair.setWeights(w);

        IRepairabilityIndex.Criteria memory c = IRepairabilityIndex.Criteria({
            documentation: 9000,
            disassembly: 100,
            spareAvailability: 100,
            sparePricing: 100,
            softwareSupport: 100
        });
        vm.prank(inspector);
        uint16 score = repair.assess(tokenId, c);
        assertEq(score, 9000);
    }

    function test_RevertWhen_WeightsNotHundred() public {
        IRepairabilityIndex.Weights memory w = IRepairabilityIndex.Weights({
            documentationW: 3000,
            disassemblyW: 3000,
            spareAvailabilityW: 3000,
            sparePricingW: 0,
            softwareSupportW: 0
        });
        vm.prank(governor);
        vm.expectRevert(abi.encodeWithSelector(IRepairabilityIndex.InvalidWeights.selector, uint16(9000)));
        repair.setWeights(w);
    }

    function test_RevertWhen_NonGovernorSetsWeights() public {
        IRepairabilityIndex.Weights memory w = repair.weights();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.GOVERNOR_ROLE)
        );
        repair.setWeights(w);
    }

    function test_RevertWhen_CriterionOutOfRange() public {
        IRepairabilityIndex.Criteria memory c = IRepairabilityIndex.Criteria({
            documentation: 10001,
            disassembly: 0,
            spareAvailability: 0,
            sparePricing: 0,
            softwareSupport: 0
        });
        vm.prank(inspector);
        vm.expectRevert(abi.encodeWithSelector(IRepairabilityIndex.CriterionOutOfRange.selector, uint16(10001)));
        repair.assess(tokenId, c);
    }

    function test_RevertWhen_NonInspectorAssesses() public {
        IRepairabilityIndex.Criteria memory c;
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.INSPECTOR_ROLE)
        );
        repair.assess(tokenId, c);
    }

    function test_RevertWhen_UnknownPassport() public {
        IRepairabilityIndex.Criteria memory c;
        vm.prank(inspector);
        vm.expectRevert(abi.encodeWithSelector(IRepairabilityIndex.UnknownPassport.selector, uint256(99)));
        repair.assess(99, c);
    }

    function test_RevertWhen_ScoreOfNotAssessed() public {
        vm.expectRevert(abi.encodeWithSelector(IRepairabilityIndex.NotAssessed.selector, tokenId));
        repair.scoreOf(tokenId);
    }

    function test_RevertWhen_CriteriaOfNotAssessed() public {
        vm.expectRevert(abi.encodeWithSelector(IRepairabilityIndex.NotAssessed.selector, tokenId));
        repair.criteriaOf(tokenId);
    }
}
