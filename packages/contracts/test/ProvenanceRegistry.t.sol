// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { ProvenanceRegistry } from "../src/ProvenanceRegistry.sol";

contract ProvenanceRegistryTest is Test {
    ProvenanceRegistry internal reg;

    address internal admin = address(0xA11CE);
    address internal supplier = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("origin");
    bytes32 internal constant DATA = keccak256("data");

    event BatchRegistered(bytes32 indexed batchId, address indexed supplier, bytes32 originHash, string metadataURI);
    event CheckpointAdded(bytes32 indexed batchId, string location, uint64 timestamp, bytes32 dataHash);

    function setUp() public {
        reg = new ProvenanceRegistry(admin);
        bytes32 registrar = reg.REGISTRAR_ROLE();
        vm.prank(admin);
        reg.grantRole(registrar, supplier);
    }

    function test_AdminHasRoles() public view {
        assertTrue(reg.hasRole(reg.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(reg.hasRole(reg.REGISTRAR_ROLE(), admin));
    }

    function test_RegisterBatch_SetsSupplierAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit BatchRegistered(BATCH, supplier, ORIGIN, "ipfs://meta");

        vm.prank(supplier);
        reg.registerBatch(BATCH, ORIGIN, "ipfs://meta");

        ProvenanceRegistry.Batch memory b = reg.getBatch(BATCH);
        assertEq(b.batchId, BATCH);
        assertEq(b.supplier, supplier);
        assertEq(b.originHash, ORIGIN);
        assertEq(b.metadataURI, "ipfs://meta");
        assertTrue(b.exists);
        assertEq(b.createdAt, uint64(block.timestamp));
        assertTrue(reg.batchExists(BATCH));
    }

    function test_RegisterBatch_RevertsWhenExists() public {
        vm.startPrank(supplier);
        reg.registerBatch(BATCH, ORIGIN, "ipfs://meta");
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.BatchExists.selector, BATCH));
        reg.registerBatch(BATCH, ORIGIN, "ipfs://meta");
        vm.stopPrank();
    }

    function test_RegisterBatch_RevertsEmptyMetadata() public {
        vm.prank(supplier);
        vm.expectRevert(ProvenanceRegistry.EmptyMetadata.selector);
        reg.registerBatch(BATCH, ORIGIN, "");
    }

    function test_RegisterBatch_RevertsUnauthorized() public {
        bytes32 registrar = reg.REGISTRAR_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, registrar)
        );
        reg.registerBatch(BATCH, ORIGIN, "ipfs://meta");
    }

    function test_AddCheckpoint_AppendsAndEmits() public {
        vm.startPrank(supplier);
        reg.registerBatch(BATCH, ORIGIN, "ipfs://meta");

        vm.expectEmit(true, false, false, true);
        emit CheckpointAdded(BATCH, "Rotterdam", 1000, DATA);
        reg.addCheckpoint(BATCH, "Rotterdam", 1000, DATA);

        reg.addCheckpoint(BATCH, "Singapore", 2000, DATA);
        vm.stopPrank();

        assertEq(reg.checkpointCount(BATCH), 2);
        ProvenanceRegistry.Checkpoint[] memory cps = reg.getCheckpoints(BATCH);
        assertEq(cps.length, 2);
        assertEq(cps[0].location, "Rotterdam");
        assertEq(cps[0].timestamp, 1000);
        assertEq(cps[1].location, "Singapore");
    }

    function test_AddCheckpoint_RevertsUnknownBatch() public {
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.UnknownBatch.selector, BATCH));
        reg.addCheckpoint(BATCH, "Rotterdam", 1000, DATA);
    }

    function test_AddCheckpoint_RevertsUnauthorized() public {
        vm.prank(supplier);
        reg.registerBatch(BATCH, ORIGIN, "ipfs://meta");

        bytes32 registrar = reg.REGISTRAR_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, registrar)
        );
        reg.addCheckpoint(BATCH, "Rotterdam", 1000, DATA);
    }

    function test_EmptyViews() public view {
        assertFalse(reg.batchExists(BATCH));
        assertEq(reg.checkpointCount(BATCH), 0);
        assertEq(reg.getCheckpoints(BATCH).length, 0);
    }
}
