// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { ProvenanceFactory } from "../../src/provenance/ProvenanceFactory.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Pauser } from "../../src/core/Pauser.sol";
import { Keys } from "../../src/core/Keys.sol";
import { IProvenanceFactory } from "../../src/interfaces/IProvenanceFactory.sol";
import { IAddressBook } from "../../src/interfaces/IAddressBook.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";

contract ProvenanceFactoryTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    ProvenanceFactory internal factory;

    address internal admin = address(0xA11CE);
    address internal creator = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant SERIES = keccak256("series-espresso");
    bytes32 internal constant BATCH_A = keccak256("batch-A");
    bytes32 internal constant BATCH_B = keccak256("batch-B");
    bytes32 internal constant ORIGIN = keccak256("origin");
    string internal constant META = "ipfs://series-meta";

    event SeriesCreated(bytes32 indexed seriesId, address indexed creator, string metadataURI);
    event RegisteredFromSeries(bytes32 indexed seriesId, bytes32 indexed batchId, uint256 index);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        factory = new ProvenanceFactory(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        // Factory registers batches on behalf of series creators -> needs REGISTRAR_ROLE.
        registry.grantRole(registry.REGISTRAR_ROLE(), address(factory));
        vm.stopPrank();
    }

    function _createSeries() internal {
        vm.prank(creator);
        factory.createSeries(SERIES, META);
    }

    function test_CreateSeries_StoresAndEmits() public {
        vm.expectEmit(true, true, false, true, address(factory));
        emit SeriesCreated(SERIES, creator, META);

        vm.prank(creator);
        factory.createSeries(SERIES, META);

        IProvenanceFactory.Series memory s = factory.seriesOf(SERIES);
        assertEq(s.seriesId, SERIES);
        assertEq(s.creator, creator);
        assertEq(s.metadataURI, META);
        assertEq(s.count, 0);
        assertTrue(s.exists);
        assertEq(s.createdAt, uint64(block.timestamp));
    }

    function test_CreateSeries_RevertsWhenExists() public {
        _createSeries();
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(IProvenanceFactory.SeriesExists.selector, SERIES));
        factory.createSeries(SERIES, META);
    }

    function test_CreateSeries_RevertsEmptyMetadata() public {
        vm.prank(creator);
        vm.expectRevert(IProvenanceFactory.EmptyMetadata.selector);
        factory.createSeries(SERIES, "");
    }

    function test_RegisterFromSeries_RegistersBatchWithSeriesMetadata() public {
        _createSeries();

        vm.expectEmit(true, true, false, true, address(factory));
        emit RegisteredFromSeries(SERIES, BATCH_A, 0);

        vm.prank(creator);
        factory.registerFromSeries(SERIES, BATCH_A, ORIGIN);

        ProvenanceRegistry.Batch memory b = registry.getBatch(BATCH_A);
        assertTrue(b.exists);
        assertEq(b.originHash, ORIGIN);
        assertEq(b.metadataURI, META);
        // The factory is the registrar/supplier of the batch on the registry.
        assertEq(b.supplier, address(factory));

        assertEq(factory.seriesOf(SERIES).count, 1);
    }

    function test_RegisterFromSeries_IncrementsIndexAcrossBatches() public {
        _createSeries();

        vm.startPrank(creator);
        factory.registerFromSeries(SERIES, BATCH_A, ORIGIN);

        vm.expectEmit(true, true, false, true, address(factory));
        emit RegisteredFromSeries(SERIES, BATCH_B, 1);
        factory.registerFromSeries(SERIES, BATCH_B, ORIGIN);
        vm.stopPrank();

        assertEq(factory.seriesOf(SERIES).count, 2);
        assertTrue(registry.batchExists(BATCH_A));
        assertTrue(registry.batchExists(BATCH_B));
    }

    function test_RegisterFromSeries_RevertsUnknownSeries() public {
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(IProvenanceFactory.UnknownSeries.selector, SERIES));
        factory.registerFromSeries(SERIES, BATCH_A, ORIGIN);
    }

    function test_RegisterFromSeries_RevertsNotSeriesCreator() public {
        _createSeries();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IProvenanceFactory.NotSeriesCreator.selector, SERIES));
        factory.registerFromSeries(SERIES, BATCH_A, ORIGIN);
    }

    function test_RegisterFromSeries_RevertsDuplicateBatch() public {
        _createSeries();
        vm.startPrank(creator);
        factory.registerFromSeries(SERIES, BATCH_A, ORIGIN);
        // Registry rejects a duplicate batchId; the revert propagates through the factory.
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.BatchExists.selector, BATCH_A));
        factory.registerFromSeries(SERIES, BATCH_A, ORIGIN);
        vm.stopPrank();
    }

    function test_RegisterFromSeries_RevertsWhenGloballyPaused() public {
        _createSeries();
        Pauser pauser = new Pauser(admin);
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.prank(creator);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        factory.registerFromSeries(SERIES, BATCH_A, ORIGIN);
    }

    function test_CreateSeries_RevertsWhenGloballyPaused() public {
        Pauser pauser = new Pauser(admin);
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.prank(creator);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        factory.createSeries(SERIES, META);
    }

    function test_RegisterFromSeries_RevertsWhenRegistryUnwired() public {
        AddressBook freshBook = new AddressBook(admin);
        ProvenanceFactory freshFactory = new ProvenanceFactory(address(freshBook), admin);

        vm.startPrank(creator);
        freshFactory.createSeries(SERIES, META);
        vm.expectRevert(abi.encodeWithSelector(IAddressBook.AddressNotFound.selector, Keys.PROVENANCE_REGISTRY));
        freshFactory.registerFromSeries(SERIES, BATCH_A, ORIGIN);
        vm.stopPrank();
    }

    function test_SeriesOf_EmptyForUnknown() public view {
        IProvenanceFactory.Series memory s = factory.seriesOf(keccak256("ghost"));
        assertFalse(s.exists);
        assertEq(s.count, 0);
    }
}
