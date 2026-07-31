// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { DigitalProductPassport } from "../../src/dpp/DigitalProductPassport.sol";
import { DPPLifecycleRegistry } from "../../src/dpp/DPPLifecycleRegistry.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IDPPLifecycleRegistry } from "../../src/interfaces/IDPPLifecycleRegistry.sol";

contract DPPLifecycleRegistryTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    DigitalProductPassport internal dpp;
    DPPLifecycleRegistry internal lifecycle;

    address internal admin = address(0xA11CE);
    address internal manufacturer = address(0xBEEF);
    address internal registrar = address(0xCAFE);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant DATA_HASH = keccak256("payload");
    uint256 internal tokenId;

    event LifecycleRecorded(
        uint256 indexed tokenId, uint256 indexed index, IDPPLifecycleRegistry.EventType eventType, address indexed actor, bytes32 dataHash
    );

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        dpp = new DigitalProductPassport(address(book), admin);
        lifecycle = new DPPLifecycleRegistry(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        book.setAddress(Keys.DIGITAL_PRODUCT_PASSPORT, address(dpp));
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerBatch(BATCH, keccak256("origin"), "ipfs://m");
        lifecycle.grantRole(Roles.REGISTRAR_ROLE, registrar);
        tokenId = dpp.issue(BATCH, keccak256("gtin"), manufacturer, "ipfs://doc");
        vm.stopPrank();
    }

    function test_Record_ByRegistrar() public {
        vm.expectEmit(true, true, true, true, address(lifecycle));
        emit LifecycleRecorded(tokenId, 0, IDPPLifecycleRegistry.EventType.Manufactured, registrar, DATA_HASH);

        vm.prank(registrar);
        uint256 idx = lifecycle.record(tokenId, IDPPLifecycleRegistry.EventType.Manufactured, DATA_HASH, "Lyon");
        assertEq(idx, 0);
        assertEq(lifecycle.eventCount(tokenId), 1);

        IDPPLifecycleRegistry.LifecycleEvent memory e = lifecycle.eventAt(tokenId, 0);
        assertEq(uint8(e.eventType), uint8(IDPPLifecycleRegistry.EventType.Manufactured));
        assertEq(e.actor, registrar);
        assertEq(e.dataHash, DATA_HASH);
        assertEq(e.location, "Lyon");
    }

    function test_Record_ByOwner() public {
        vm.prank(manufacturer);
        uint256 idx = lifecycle.record(tokenId, IDPPLifecycleRegistry.EventType.Sold, DATA_HASH, "Paris");
        assertEq(idx, 0);
    }

    function test_Record_AppendsInOrder() public {
        vm.startPrank(registrar);
        lifecycle.record(tokenId, IDPPLifecycleRegistry.EventType.Manufactured, DATA_HASH, "a");
        lifecycle.record(tokenId, IDPPLifecycleRegistry.EventType.Sold, DATA_HASH, "b");
        uint256 idx = lifecycle.record(tokenId, IDPPLifecycleRegistry.EventType.Repaired, DATA_HASH, "c");
        vm.stopPrank();
        assertEq(idx, 2);
        assertEq(lifecycle.eventCount(tokenId), 3);
        assertEq(uint8(lifecycle.eventAt(tokenId, 1).eventType), uint8(IDPPLifecycleRegistry.EventType.Sold));
    }

    function test_RevertWhen_UnknownPassport() public {
        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(IDPPLifecycleRegistry.UnknownPassport.selector, uint256(99)));
        lifecycle.record(99, IDPPLifecycleRegistry.EventType.Sold, DATA_HASH, "x");
    }

    function test_RevertWhen_NotAuthorized() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IDPPLifecycleRegistry.NotAuthorized.selector, tokenId));
        lifecycle.record(tokenId, IDPPLifecycleRegistry.EventType.Sold, DATA_HASH, "x");
    }

    function test_RevertWhen_IndexOutOfRange() public {
        vm.prank(registrar);
        lifecycle.record(tokenId, IDPPLifecycleRegistry.EventType.Sold, DATA_HASH, "x");
        vm.expectRevert(abi.encodeWithSelector(IDPPLifecycleRegistry.IndexOutOfRange.selector, tokenId, uint256(1)));
        lifecycle.eventAt(tokenId, 1);
    }
}
