// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AttestationRegistry } from "../../src/AttestationRegistry.sol";
import { SettlementEscrow } from "../../src/SettlementEscrow.sol";
import { SettlementRouter } from "../../src/payments/SettlementRouter.sol";
import { ISettlementRouter } from "../../src/interfaces/ISettlementRouter.sol";
import { ISettlementEscrow } from "../../src/interfaces/ISettlementEscrow.sol";
import { Keys } from "../../src/core/Keys.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockReputationEngine } from "./mocks/MockReputationEngine.sol";

contract SettlementRouterTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal prov;
    AttestationRegistry internal att;
    SettlementEscrow internal escrow;
    SettlementRouter internal router;
    MockReputationEngine internal reputation;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal agent = address(0xA6E7);
    address internal supplier = address(0xB0B);
    address internal buyer = address(0xB111);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("origin");
    bytes32 internal constant VHASH = keccak256("verdict");
    uint256 internal constant AMOUNT = 1_000e6;

    event FullySettled(bytes32 indexed batchId, bool released, uint16 score);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        prov = new ProvenanceRegistry(admin);
        att = new AttestationRegistry(admin, address(prov));
        escrow = new SettlementEscrow(admin, address(att), address(prov));
        router = new SettlementRouter(address(book), admin);
        reputation = new MockReputationEngine();

        att.grantRole(att.AGENT_ROLE(), agent);
        prov.grantRole(prov.REGISTRAR_ROLE(), supplier);

        book.setAddress(Keys.SETTLEMENT_ESCROW, address(escrow));
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        book.setAddress(Keys.REPUTATION_ENGINE, address(reputation));
        vm.stopPrank();

        usdc = new MockUSDC();

        vm.prank(supplier);
        prov.registerBatch(BATCH, ORIGIN, "ipfs://meta");
    }

    function _fund() internal {
        usdc.mint(buyer, AMOUNT);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), AMOUNT);
        escrow.fund(BATCH, supplier, address(usdc), AMOUNT);
        vm.stopPrank();
    }

    function _attest(uint16 score) internal {
        vm.prank(agent);
        att.attest(BATCH, score, VHASH, "ipfs://verdict");
    }

    function test_SettleFull_ReleasesAndRecordsReputation() public {
        _fund();
        _attest(9600);

        vm.expectEmit(true, false, false, true);
        emit FullySettled(BATCH, true, 9600);
        bool released = router.settleFull(BATCH);

        assertTrue(released);
        assertEq(uint8(escrow.getDeal(BATCH).state), uint8(ISettlementEscrow.DealState.Released));
        assertEq(usdc.balanceOf(supplier), AMOUNT);

        (address recSupplier, bool passed, uint16 score) = reputation.last();
        assertEq(recSupplier, supplier);
        assertTrue(passed);
        assertEq(score, 9600);
        assertEq(reputation.calls(), 1);
    }

    function test_SettleFull_DisputesOnFail() public {
        _fund();
        _attest(4000);

        vm.expectEmit(true, false, false, true);
        emit FullySettled(BATCH, false, 4000);
        bool released = router.settleFull(BATCH);

        assertFalse(released);
        assertEq(uint8(escrow.getDeal(BATCH).state), uint8(ISettlementEscrow.DealState.Disputed));
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);

        (, bool passed,) = reputation.last();
        assertFalse(passed);
    }

    function test_SettleFull_RevertsNotAttested() public {
        _fund();
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.NotAttested.selector, BATCH));
        router.settleFull(BATCH);
    }

    function test_SettleFull_RevertsNotFunded() public {
        _attest(9600); // attested but never funded
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.NotFunded.selector, BATCH));
        router.settleFull(BATCH);
    }

    function test_SettleFull_GracefulWhenReputationReverts() public {
        _fund();
        _attest(9600);
        reputation.setShouldRevert(true);

        // Settlement must still succeed even though the reputation hook reverts.
        bool released = router.settleFull(BATCH);
        assertTrue(released);
        assertEq(usdc.balanceOf(supplier), AMOUNT);
        assertEq(reputation.calls(), 0);
    }

    function test_SettleFull_WorksWithoutReputationEngine() public {
        // Fresh router+book with no reputation key exercises the `_addrOrZero == 0` branch
        // (AddressBook keys cannot be unset to zero, so a clean book is used).
        vm.startPrank(admin);
        AddressBook book2 = new AddressBook(admin);
        book2.setAddress(Keys.SETTLEMENT_ESCROW, address(escrow));
        book2.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        SettlementRouter router2 = new SettlementRouter(address(book2), admin);
        vm.stopPrank();

        _fund();
        _attest(9600);
        bool released = router2.settleFull(BATCH);
        assertTrue(released);
        assertEq(usdc.balanceOf(supplier), AMOUNT);
    }
}
