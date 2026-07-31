// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { CheckpointOracle } from "../../src/provenance/CheckpointOracle.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Pauser } from "../../src/core/Pauser.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ICheckpointOracle } from "../../src/interfaces/ICheckpointOracle.sol";
import { IAddressBook } from "../../src/interfaces/IAddressBook.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";

contract CheckpointOracleTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    CheckpointOracle internal oracle;

    address internal admin = address(0xA11CE);
    address internal keeper = address(0xC0FFEE);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("origin");
    bytes32 internal constant DATA = keccak256("sensor-payload");

    event CheckpointPushed(
        bytes32 indexed batchId, string location, int256 temp, bytes32 dataHash, address indexed keeper
    );
    event CheckpointAdded(bytes32 indexed batchId, string location, uint64 timestamp, bytes32 dataHash);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        oracle = new CheckpointOracle(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        // Oracle must hold REGISTRAR_ROLE to append to the append-only registry.
        registry.grantRole(registry.REGISTRAR_ROLE(), address(oracle));
        oracle.grantRole(Roles.KEEPER_ROLE, keeper);
        // Register a batch the oracle can push checkpoints against.
        registry.registerBatch(BATCH, ORIGIN, "ipfs://meta");
        vm.stopPrank();
    }

    function test_AdminHasKeeperRole() public view {
        assertTrue(oracle.hasRole(oracle.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(oracle.hasRole(Roles.KEEPER_ROLE, admin));
    }

    function test_PushCheckpoint_AppendsToRegistryAndEmits() public {
        // Registry-level append event.
        vm.expectEmit(true, false, false, true, address(registry));
        emit CheckpointAdded(BATCH, "Rotterdam", uint64(block.timestamp), DATA);
        // Oracle-level feed event.
        vm.expectEmit(true, true, false, true, address(oracle));
        emit CheckpointPushed(BATCH, "Rotterdam", -400, DATA, keeper);

        vm.prank(keeper);
        oracle.pushCheckpoint(BATCH, "Rotterdam", -400, DATA);

        assertEq(registry.checkpointCount(BATCH), 1);
        ProvenanceRegistry.Checkpoint[] memory cps = registry.getCheckpoints(BATCH);
        assertEq(cps[0].location, "Rotterdam");
        assertEq(cps[0].dataHash, DATA);
        assertEq(cps[0].timestamp, uint64(block.timestamp));
    }

    function test_PushCheckpoint_MultipleAppendsInOrder() public {
        vm.startPrank(keeper);
        oracle.pushCheckpoint(BATCH, "Rotterdam", -400, DATA);
        oracle.pushCheckpoint(BATCH, "Singapore", 250, DATA);
        vm.stopPrank();

        assertEq(registry.checkpointCount(BATCH), 2);
        ProvenanceRegistry.Checkpoint[] memory cps = registry.getCheckpoints(BATCH);
        assertEq(cps[0].location, "Rotterdam");
        assertEq(cps[1].location, "Singapore");
    }

    function test_PushCheckpoint_AdminIsKeeper() public {
        vm.prank(admin);
        oracle.pushCheckpoint(BATCH, "Hamburg", 100, DATA);
        assertEq(registry.checkpointCount(BATCH), 1);
    }

    function test_PushCheckpoint_RevertsNotKeeper() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ICheckpointOracle.NotKeeper.selector, stranger));
        oracle.pushCheckpoint(BATCH, "Rotterdam", -400, DATA);
    }

    function test_PushCheckpoint_RevertsUnknownBatch() public {
        bytes32 unknown = keccak256("nope");
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(ICheckpointOracle.UnknownBatch.selector, unknown));
        oracle.pushCheckpoint(unknown, "Rotterdam", -400, DATA);
    }

    function test_PushCheckpoint_RevertsWhenGloballyPaused() public {
        Pauser pauser = new Pauser(admin);
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.prank(keeper);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        oracle.pushCheckpoint(BATCH, "Rotterdam", -400, DATA);
    }

    function test_PushCheckpoint_RevertsWhenRegistryUnwired() public {
        // Fresh book/oracle with no ProvenanceRegistry key registered.
        AddressBook freshBook = new AddressBook(admin);
        CheckpointOracle freshOracle = new CheckpointOracle(address(freshBook), admin);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IAddressBook.AddressNotFound.selector, Keys.PROVENANCE_REGISTRY));
        freshOracle.pushCheckpoint(BATCH, "Rotterdam", -400, DATA);
    }

    function test_PushCheckpoint_RevertsWhenOracleLacksRegistrarRole() public {
        // Deploy an oracle that is a keeper but was never granted REGISTRAR_ROLE on the registry.
        CheckpointOracle unauthOracle = new CheckpointOracle(address(book), admin);
        vm.prank(admin);
        unauthOracle.grantRole(Roles.KEEPER_ROLE, keeper);

        vm.prank(keeper);
        vm.expectRevert(); // AccessControl revert bubbles up from the registry.
        unauthOracle.pushCheckpoint(BATCH, "Rotterdam", -400, DATA);
    }
}
