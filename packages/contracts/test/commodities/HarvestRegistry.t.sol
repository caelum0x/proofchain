// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { HarvestRegistry } from "../../src/commodities/HarvestRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { IHarvestRegistry } from "../../src/interfaces/IHarvestRegistry.sol";

contract HarvestRegistryTest is Test {
    AddressBook internal book;
    HarvestRegistry internal registry;

    address internal admin = address(0xA11CE);
    address internal registrar = address(0x2E6);
    address internal grader = address(0x62A);
    address internal producer = address(0xA71CE);
    address internal gradingRegistry = address(0x62AD);
    address internal storageReceipt = address(0x570A);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant HARVEST = keccak256("harvest-1");
    bytes32 internal constant CROP = keccak256("COFFEE");
    bytes32 internal constant GEO = keccak256("geohash");
    bytes32 internal constant SEASON = keccak256("2026-wet");
    bytes32 internal constant GRADE = keccak256("A");
    bytes32 internal constant RECEIPT = keccak256("receipt-1");

    event HarvestRegistered(
        bytes32 indexed harvestId, address indexed producer, bytes32 indexed crop, uint256 quantityKg, bytes32 season
    );
    event HarvestGraded(bytes32 indexed harvestId, bytes32 grade);
    event HarvestStored(bytes32 indexed harvestId, bytes32 indexed receiptId);
    event QuantityAdjusted(bytes32 indexed harvestId, uint256 oldQuantityKg, uint256 newQuantityKg);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new HarvestRegistry(address(book), admin);

        vm.startPrank(admin);
        registry.grantRole(Roles.REGISTRAR_ROLE, registrar);
        registry.grantRole(Roles.GRADER_ROLE, grader);
        book.setAddress(Keys.GRADING_REGISTRY, gradingRegistry);
        book.setAddress(Keys.STORAGE_RECEIPT, storageReceipt);
        vm.stopPrank();
    }

    function _register() internal {
        vm.prank(producer);
        registry.registerHarvest(HARVEST, producer, CROP, GEO, SEASON, 5000, uint64(block.timestamp), bytes32(0));
    }

    function test_Register_SelfProducer() public {
        vm.expectEmit(true, true, true, true, address(registry));
        emit HarvestRegistered(HARVEST, producer, CROP, 5000, SEASON);

        _register();

        IHarvestRegistry.Harvest memory h = registry.harvestOf(HARVEST);
        assertEq(h.producer, producer);
        assertEq(h.quantityKg, 5000);
        assertEq(uint8(h.state), uint8(IHarvestRegistry.HarvestState.Registered));
    }

    function test_Register_ByRegistrarOnBehalf() public {
        vm.prank(registrar);
        registry.registerHarvest(HARVEST, producer, CROP, GEO, SEASON, 5000, uint64(block.timestamp), bytes32(0));
        assertEq(registry.harvestOf(HARVEST).producer, producer);
    }

    function test_RevertWhen_UnauthorizedRegisters() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IHarvestRegistry.NotProducer.selector, HARVEST));
        registry.registerHarvest(HARVEST, producer, CROP, GEO, SEASON, 5000, uint64(block.timestamp), bytes32(0));
    }

    function test_RevertWhen_RegisterZeroQuantity() public {
        vm.prank(producer);
        vm.expectRevert(IHarvestRegistry.ZeroQuantity.selector);
        registry.registerHarvest(HARVEST, producer, CROP, GEO, SEASON, 0, uint64(block.timestamp), bytes32(0));
    }

    function test_RevertWhen_RegisterZeroProducer() public {
        vm.prank(registrar);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        registry.registerHarvest(HARVEST, address(0), CROP, GEO, SEASON, 5000, uint64(block.timestamp), bytes32(0));
    }

    function test_RevertWhen_RegisterDuplicate() public {
        _register();
        vm.prank(producer);
        vm.expectRevert(abi.encodeWithSelector(IHarvestRegistry.HarvestExists.selector, HARVEST));
        registry.registerHarvest(HARVEST, producer, CROP, GEO, SEASON, 5000, uint64(block.timestamp), bytes32(0));
    }

    function test_AdjustQuantity_HappyPath() public {
        _register();
        vm.expectEmit(true, false, false, true, address(registry));
        emit QuantityAdjusted(HARVEST, 5000, 4800);

        vm.prank(producer);
        registry.adjustQuantity(HARVEST, 4800);
        assertEq(registry.harvestOf(HARVEST).quantityKg, 4800);
    }

    function test_RevertWhen_AdjustByStranger() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IHarvestRegistry.NotProducer.selector, HARVEST));
        registry.adjustQuantity(HARVEST, 4800);
    }

    function test_RevertWhen_AdjustUnknown() public {
        vm.prank(producer);
        vm.expectRevert(abi.encodeWithSelector(IHarvestRegistry.UnknownHarvest.selector, HARVEST));
        registry.adjustQuantity(HARVEST, 4800);
    }

    function test_MarkGraded_ByGrader() public {
        _register();
        vm.expectEmit(true, false, false, true, address(registry));
        emit HarvestGraded(HARVEST, GRADE);

        vm.prank(grader);
        registry.markGraded(HARVEST, GRADE);
        assertEq(uint8(registry.harvestOf(HARVEST).state), uint8(IHarvestRegistry.HarvestState.Graded));
    }

    function test_MarkGraded_ByGradingRegistryPeer() public {
        _register();
        vm.prank(gradingRegistry);
        registry.markGraded(HARVEST, GRADE);
        assertEq(uint8(registry.harvestOf(HARVEST).state), uint8(IHarvestRegistry.HarvestState.Graded));
    }

    function test_RevertWhen_MarkGradedByStranger() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IHarvestRegistry.NotProducer.selector, HARVEST));
        registry.markGraded(HARVEST, GRADE);
    }

    function test_RevertWhen_MarkGradedWrongState() public {
        _register();
        vm.prank(grader);
        registry.markGraded(HARVEST, GRADE);
        // Second grading attempt: no longer in Registered state.
        vm.prank(grader);
        vm.expectRevert(
            abi.encodeWithSelector(
                IHarvestRegistry.InvalidState.selector,
                HARVEST,
                IHarvestRegistry.HarvestState.Registered,
                IHarvestRegistry.HarvestState.Graded
            )
        );
        registry.markGraded(HARVEST, GRADE);
    }

    function test_MarkStored_ByStorageReceiptPeer() public {
        _register();
        vm.prank(grader);
        registry.markGraded(HARVEST, GRADE);

        vm.expectEmit(true, true, false, false, address(registry));
        emit HarvestStored(HARVEST, RECEIPT);

        vm.prank(storageReceipt);
        registry.markStored(HARVEST, RECEIPT);
        assertEq(uint8(registry.harvestOf(HARVEST).state), uint8(IHarvestRegistry.HarvestState.Stored));
    }

    function test_RevertWhen_MarkStoredBeforeGraded() public {
        _register();
        vm.prank(registrar);
        vm.expectRevert(
            abi.encodeWithSelector(
                IHarvestRegistry.InvalidState.selector,
                HARVEST,
                IHarvestRegistry.HarvestState.Graded,
                IHarvestRegistry.HarvestState.Registered
            )
        );
        registry.markStored(HARVEST, RECEIPT);
    }

    function test_RevertWhen_AdjustAfterStored() public {
        _register();
        vm.prank(grader);
        registry.markGraded(HARVEST, GRADE);
        vm.prank(storageReceipt);
        registry.markStored(HARVEST, RECEIPT);

        vm.prank(producer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IHarvestRegistry.InvalidState.selector,
                HARVEST,
                IHarvestRegistry.HarvestState.Registered,
                IHarvestRegistry.HarvestState.Stored
            )
        );
        registry.adjustQuantity(HARVEST, 4000);
    }
}
