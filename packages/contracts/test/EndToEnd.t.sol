// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { ProvenanceRegistry } from "../src/ProvenanceRegistry.sol";
import { AttestationRegistry } from "../src/AttestationRegistry.sol";
import { SettlementEscrow } from "../src/SettlementEscrow.sol";
import { ISettlementEscrow } from "../src/interfaces/ISettlementEscrow.sol";
import { MockUSDC } from "../src/MockUSDC.sol";

/// @notice Full lifecycle: register -> checkpoint -> attest -> fund -> settle release.
contract EndToEndTest is Test {
    ProvenanceRegistry internal prov;
    AttestationRegistry internal att;
    SettlementEscrow internal escrow;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal agent = address(0xA6E7);
    address internal supplier = address(0xB0B);
    address internal buyer = address(0xB111);

    bytes32 internal constant BATCH = keccak256("shipment-42");
    bytes32 internal constant ORIGIN = keccak256("origin-42");
    bytes32 internal constant DATA = keccak256("checkpoint-data");
    bytes32 internal constant VHASH = keccak256("verdict-42");
    uint256 internal constant AMOUNT = 25_000e6;

    function setUp() public {
        vm.startPrank(admin);
        prov = new ProvenanceRegistry(admin);
        att = new AttestationRegistry(admin, address(prov));
        escrow = new SettlementEscrow(admin, address(att), address(prov));
        prov.grantRole(prov.REGISTRAR_ROLE(), supplier);
        att.grantRole(att.AGENT_ROLE(), agent);
        vm.stopPrank();

        usdc = new MockUSDC();
    }

    function test_FullLifecycle_RegisterToRelease() public {
        // 1. Supplier registers a batch.
        vm.startPrank(supplier);
        prov.registerBatch(BATCH, ORIGIN, "ipfs://batch-meta");

        // 2. Supplier appends checkpoints along the route.
        prov.addCheckpoint(BATCH, "Shanghai", uint64(block.timestamp), DATA);
        prov.addCheckpoint(BATCH, "Rotterdam", uint64(block.timestamp + 1 days), DATA);
        vm.stopPrank();
        assertEq(prov.checkpointCount(BATCH), 2);

        // 3. Buyer funds the escrow.
        usdc.mint(buyer, AMOUNT);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), AMOUNT);
        escrow.fund(BATCH, supplier, address(usdc), AMOUNT);
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);

        // 4. Agent attests a passing score.
        vm.prank(agent);
        att.attest(BATCH, 9800, VHASH, "ipfs://verdict-42");
        assertTrue(att.isAttested(BATCH));

        // 5. Anyone settles -> released to supplier.
        escrow.settle(BATCH);

        assertEq(uint8(escrow.getDeal(BATCH).state), uint8(ISettlementEscrow.DealState.Released));
        assertEq(usdc.balanceOf(supplier), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_FullLifecycle_FraudToRefund() public {
        vm.prank(supplier);
        prov.registerBatch(BATCH, ORIGIN, "ipfs://batch-meta");

        usdc.mint(buyer, AMOUNT);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), AMOUNT);
        escrow.fund(BATCH, supplier, address(usdc), AMOUNT);
        vm.stopPrank();

        // Failing score -> Disputed.
        vm.prank(agent);
        att.attest(BATCH, 3000, VHASH, "ipfs://verdict-42");
        escrow.settle(BATCH);
        assertEq(uint8(escrow.getDeal(BATCH).state), uint8(ISettlementEscrow.DealState.Disputed));

        // Admin resolves dispute -> refund buyer.
        vm.prank(admin);
        escrow.refund(BATCH);
        assertEq(uint8(escrow.getDeal(BATCH).state), uint8(ISettlementEscrow.DealState.Refunded));
        assertEq(usdc.balanceOf(buyer), AMOUNT);
    }
}
