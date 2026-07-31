// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { BatchMetadataStore } from "../../src/provenance/BatchMetadataStore.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Pauser } from "../../src/core/Pauser.sol";
import { Keys } from "../../src/core/Keys.sol";
import { IBatchMetadataStore } from "../../src/interfaces/IBatchMetadataStore.sol";
import { IAddressBook } from "../../src/interfaces/IAddressBook.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";

contract BatchMetadataStoreTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    BatchMetadataStore internal store;

    address internal admin = address(0xA11CE);
    address internal supplier = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("origin");

    bytes32 internal constant K_HS = keccak256("hsCode");
    bytes32 internal constant K_WEIGHT = keccak256("grossWeightKg");

    event MetadataSet(bytes32 indexed batchId, bytes32 indexed key, string value);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        store = new BatchMetadataStore(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        registry.grantRole(registry.REGISTRAR_ROLE(), supplier);
        vm.stopPrank();

        // Supplier owns the batch on the registry.
        vm.prank(supplier);
        registry.registerBatch(BATCH, ORIGIN, "ipfs://meta");
    }

    function _kv(bytes32 key, string memory value) internal pure returns (IBatchMetadataStore.KV[] memory arr) {
        arr = new IBatchMetadataStore.KV[](1);
        arr[0] = IBatchMetadataStore.KV({ key: key, value: value });
    }

    function test_SetMetadata_StoresAndEmits() public {
        IBatchMetadataStore.KV[] memory kvs = new IBatchMetadataStore.KV[](2);
        kvs[0] = IBatchMetadataStore.KV({ key: K_HS, value: "0901.21" });
        kvs[1] = IBatchMetadataStore.KV({ key: K_WEIGHT, value: "18000" });

        vm.expectEmit(true, true, false, true, address(store));
        emit MetadataSet(BATCH, K_HS, "0901.21");
        vm.expectEmit(true, true, false, true, address(store));
        emit MetadataSet(BATCH, K_WEIGHT, "18000");

        vm.prank(supplier);
        store.setMetadata(BATCH, kvs);

        assertEq(store.getMetadata(BATCH, K_HS), "0901.21");
        assertEq(store.getMetadata(BATCH, K_WEIGHT), "18000");

        bytes32[] memory keys = store.keysOf(BATCH);
        assertEq(keys.length, 2);
        assertEq(keys[0], K_HS);
        assertEq(keys[1], K_WEIGHT);
    }

    function test_SetMetadata_OverwriteDoesNotDuplicateKey() public {
        vm.startPrank(supplier);
        store.setMetadata(BATCH, _kv(K_HS, "0901.21"));
        store.setMetadata(BATCH, _kv(K_HS, "0901.22"));
        vm.stopPrank();

        assertEq(store.getMetadata(BATCH, K_HS), "0901.22");
        assertEq(store.keysOf(BATCH).length, 1);
    }

    function test_SetMetadata_RevertsEmptyKeys() public {
        IBatchMetadataStore.KV[] memory empty = new IBatchMetadataStore.KV[](0);
        vm.prank(supplier);
        vm.expectRevert(IBatchMetadataStore.EmptyKeys.selector);
        store.setMetadata(BATCH, empty);
    }

    function test_SetMetadata_RevertsUnknownBatch() public {
        bytes32 unknown = keccak256("nope");
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IBatchMetadataStore.UnknownBatch.selector, unknown));
        store.setMetadata(unknown, _kv(K_HS, "x"));
    }

    function test_SetMetadata_RevertsNotBatchSupplier() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IBatchMetadataStore.NotBatchSupplier.selector, BATCH));
        store.setMetadata(BATCH, _kv(K_HS, "x"));
    }

    function test_SetMetadata_RevertsWhenGloballyPaused() public {
        Pauser pauser = new Pauser(admin);
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.prank(supplier);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        store.setMetadata(BATCH, _kv(K_HS, "x"));
    }

    function test_SetMetadata_RevertsWhenRegistryUnwired() public {
        AddressBook freshBook = new AddressBook(admin);
        BatchMetadataStore freshStore = new BatchMetadataStore(address(freshBook), admin);

        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IAddressBook.AddressNotFound.selector, Keys.PROVENANCE_REGISTRY));
        freshStore.setMetadata(BATCH, _kv(K_HS, "x"));
    }

    function test_Views_EmptyForUnsetBatch() public view {
        assertEq(store.getMetadata(keccak256("ghost"), K_HS), "");
        assertEq(store.keysOf(keccak256("ghost")).length, 0);
    }
}
