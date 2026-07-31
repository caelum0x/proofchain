// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { SustainabilityOracle } from "../../src/esg/SustainabilityOracle.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ISustainabilityOracle } from "../../src/interfaces/ISustainabilityOracle.sol";

contract SustainabilityOracleTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    SustainabilityOracle internal oracle;

    address internal admin = address(0xA11CE);
    address internal keeper = address(0xC0FFEE);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("origin");

    event EmissionsPushed(bytes32 indexed batchId, uint256 co2e, address indexed keeper);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        oracle = new SustainabilityOracle(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerBatch(BATCH, ORIGIN, "ipfs://meta");
        oracle.grantRole(Roles.KEEPER_ROLE, keeper);
        vm.stopPrank();
    }

    function test_PushEmissions_HappyPath() public {
        vm.expectEmit(true, true, false, true, address(oracle));
        emit EmissionsPushed(BATCH, 123456, keeper);

        vm.prank(keeper);
        oracle.pushEmissions(BATCH, 123456);

        assertEq(oracle.emissionsOf(BATCH), 123456);
    }

    function test_PushEmissions_OverwritesLatest() public {
        vm.startPrank(keeper);
        oracle.pushEmissions(BATCH, 100);
        oracle.pushEmissions(BATCH, 250);
        vm.stopPrank();
        assertEq(oracle.emissionsOf(BATCH), 250);
    }

    function test_RevertWhen_NotKeeper() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISustainabilityOracle.NotKeeper.selector, stranger));
        oracle.pushEmissions(BATCH, 100);
    }

    function test_RevertWhen_UnknownBatch() public {
        bytes32 ghost = keccak256("ghost");
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(ISustainabilityOracle.UnknownBatch.selector, ghost));
        oracle.pushEmissions(ghost, 100);
    }

    function test_UnsetBatch_ReturnsZero() public view {
        assertEq(oracle.emissionsOf(keccak256("never")), 0);
    }
}
