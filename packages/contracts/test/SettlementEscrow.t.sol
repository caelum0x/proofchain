// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { ProvenanceRegistry } from "../src/ProvenanceRegistry.sol";
import { AttestationRegistry } from "../src/AttestationRegistry.sol";
import { SettlementEscrow } from "../src/SettlementEscrow.sol";
import { ISettlementEscrow } from "../src/interfaces/ISettlementEscrow.sol";
import { MockUSDC } from "../src/MockUSDC.sol";
import { ReentrantToken } from "./mocks/ReentrantToken.sol";

contract SettlementEscrowTest is Test {
    ProvenanceRegistry internal prov;
    AttestationRegistry internal att;
    SettlementEscrow internal escrow;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal agent = address(0xA6E7);
    address internal supplier = address(0xB0B);
    address internal buyer = address(0xB111);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("origin");
    bytes32 internal constant VHASH = keccak256("verdict");
    uint256 internal constant AMOUNT = 1_000e6;

    event Funded(bytes32 indexed batchId, address indexed buyer, address supplier, address token, uint256 amount);
    event Released(bytes32 indexed batchId, address indexed supplier, uint256 amount);
    event Disputed(bytes32 indexed batchId, uint16 score);
    event Refunded(bytes32 indexed batchId, address indexed buyer, uint256 amount);
    event PassThresholdUpdated(uint16 oldT, uint16 newT);

    function setUp() public {
        vm.startPrank(admin);
        prov = new ProvenanceRegistry(admin);
        att = new AttestationRegistry(admin, address(prov));
        escrow = new SettlementEscrow(admin, address(att), address(prov));
        att.grantRole(att.AGENT_ROLE(), agent);
        // The supplier registers its own batches (batch.supplier == supplier).
        prov.grantRole(prov.REGISTRAR_ROLE(), supplier);
        vm.stopPrank();

        usdc = new MockUSDC();

        // Register the batch in provenance so fund() passes the existence check.
        vm.prank(supplier);
        prov.registerBatch(BATCH, ORIGIN, "ipfs://meta");

        // Fund the buyer and approve escrow.
        usdc.mint(buyer, AMOUNT);
        vm.prank(buyer);
        usdc.approve(address(escrow), AMOUNT);
    }

    // ---------------------------------------------------------------------
    // Construction / config
    // ---------------------------------------------------------------------

    function test_Constructor_DefaultThreshold() public view {
        assertEq(escrow.passThreshold(), 7000);
        assertEq(address(escrow.attestations()), address(att));
        assertEq(address(escrow.provenance()), address(prov));
    }

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(ISettlementEscrow.ZeroAddress.selector);
        new SettlementEscrow(address(0), address(att), address(prov));
        vm.expectRevert(ISettlementEscrow.ZeroAddress.selector);
        new SettlementEscrow(admin, address(0), address(prov));
        vm.expectRevert(ISettlementEscrow.ZeroAddress.selector);
        new SettlementEscrow(admin, address(att), address(0));
    }

    function test_SetPassThreshold() public {
        vm.expectEmit(false, false, false, true);
        emit PassThresholdUpdated(7000, 8000);
        vm.prank(admin);
        escrow.setPassThreshold(8000);
        assertEq(escrow.passThreshold(), 8000);
    }

    function test_SetPassThreshold_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        escrow.setPassThreshold(8000);
    }

    function test_SetPassThreshold_RevertsInvalid() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.InvalidThreshold.selector, uint16(10_001)));
        escrow.setPassThreshold(10_001);
    }

    function test_SetPassThreshold_RevertsZero() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.InvalidThreshold.selector, uint16(0)));
        escrow.setPassThreshold(0);
    }

    // ---------------------------------------------------------------------
    // fund
    // ---------------------------------------------------------------------

    function test_Fund_HappyPath() public {
        vm.expectEmit(true, true, false, true);
        emit Funded(BATCH, buyer, supplier, address(usdc), AMOUNT);
        vm.prank(buyer);
        escrow.fund(BATCH, supplier, address(usdc), AMOUNT);

        ISettlementEscrow.Deal memory d = escrow.getDeal(BATCH);
        assertEq(uint8(d.state), uint8(ISettlementEscrow.DealState.Funded));
        assertEq(d.buyer, buyer);
        assertEq(d.supplier, supplier);
        assertEq(d.amount, AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
        assertEq(usdc.balanceOf(buyer), 0);
    }

    function test_Fund_RevertsZeroAmount() public {
        vm.prank(buyer);
        vm.expectRevert(ISettlementEscrow.ZeroAmount.selector);
        escrow.fund(BATCH, supplier, address(usdc), 0);
    }

    function test_Fund_RevertsZeroSupplier() public {
        vm.prank(buyer);
        vm.expectRevert(ISettlementEscrow.ZeroAddress.selector);
        escrow.fund(BATCH, address(0), address(usdc), AMOUNT);
    }

    function test_Fund_RevertsZeroToken() public {
        vm.prank(buyer);
        vm.expectRevert(ISettlementEscrow.ZeroAddress.selector);
        escrow.fund(BATCH, supplier, address(0), AMOUNT);
    }

    function test_Fund_RevertsUnknownBatch() public {
        bytes32 unknown = keccak256("nope");
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.UnknownBatch.selector, unknown));
        escrow.fund(unknown, supplier, address(usdc), AMOUNT);
    }

    function test_Fund_RevertsSupplierMismatch() public {
        // BATCH was registered by `supplier`; funding to a different address must revert.
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.SupplierMismatch.selector, BATCH));
        escrow.fund(BATCH, stranger, address(usdc), AMOUNT);
    }

    function test_Fund_RevertsDealExists() public {
        vm.startPrank(buyer);
        escrow.fund(BATCH, supplier, address(usdc), AMOUNT);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.DealExists.selector, BATCH));
        escrow.fund(BATCH, supplier, address(usdc), AMOUNT);
        vm.stopPrank();
    }

    function test_Fund_RevertsWhenPaused() public {
        vm.prank(admin);
        escrow.pause();
        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.fund(BATCH, supplier, address(usdc), AMOUNT);
    }

    function test_PauseUnpause_RoundTrip() public {
        vm.prank(admin);
        escrow.pause();
        assertTrue(escrow.paused());

        vm.prank(admin);
        escrow.unpause();
        assertFalse(escrow.paused());

        // fund works again after unpause
        vm.prank(buyer);
        escrow.fund(BATCH, supplier, address(usdc), AMOUNT);
        assertEq(uint8(escrow.getDeal(BATCH).state), uint8(ISettlementEscrow.DealState.Funded));
    }

    function test_Pause_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        escrow.pause();
    }

    // ---------------------------------------------------------------------
    // settle
    // ---------------------------------------------------------------------

    function _fund() internal {
        vm.prank(buyer);
        escrow.fund(BATCH, supplier, address(usdc), AMOUNT);
    }

    function _attest(uint16 score) internal {
        vm.prank(agent);
        att.attest(BATCH, score, VHASH, "ipfs://verdict");
    }

    function test_Settle_ReleasesOnPass() public {
        _fund();
        _attest(9600);

        vm.expectEmit(true, true, false, true);
        emit Released(BATCH, supplier, AMOUNT);
        escrow.settle(BATCH); // anyone

        ISettlementEscrow.Deal memory d = escrow.getDeal(BATCH);
        assertEq(uint8(d.state), uint8(ISettlementEscrow.DealState.Released));
        assertEq(usdc.balanceOf(supplier), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_Settle_DisputesOnFail() public {
        _fund();
        _attest(5000);

        vm.expectEmit(true, false, false, true);
        emit Disputed(BATCH, 5000);
        escrow.settle(BATCH);

        ISettlementEscrow.Deal memory d = escrow.getDeal(BATCH);
        assertEq(uint8(d.state), uint8(ISettlementEscrow.DealState.Disputed));
        // Funds remain escrowed until dispute resolution.
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
        assertEq(usdc.balanceOf(supplier), 0);
    }

    function test_Settle_RevertsNotFunded() public {
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.NotFunded.selector, BATCH));
        escrow.settle(BATCH);
    }

    function test_Settle_RevertsNotAttested() public {
        _fund();
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.NotAttested.selector, BATCH));
        escrow.settle(BATCH);
    }

    function test_Settle_RevertsAlreadySettled() public {
        _fund();
        _attest(9600);
        escrow.settle(BATCH);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.AlreadySettled.selector, BATCH));
        escrow.settle(BATCH);
    }

    function test_Settle_RevertsWhenPaused() public {
        _fund();
        _attest(9600);
        vm.prank(admin);
        escrow.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.settle(BATCH);
    }

    // ---------------------------------------------------------------------
    // passThreshold boundary
    // ---------------------------------------------------------------------

    function _boundaryDeal(bytes32 batchId, uint16 score) internal {
        vm.prank(supplier);
        prov.registerBatch(batchId, ORIGIN, "ipfs://meta");
        usdc.mint(buyer, AMOUNT);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), AMOUNT);
        escrow.fund(batchId, supplier, address(usdc), AMOUNT);
        vm.stopPrank();
        vm.prank(agent);
        att.attest(batchId, score, VHASH, "ipfs://verdict");
    }

    function test_Boundary_ExactlyAtThreshold_Releases() public {
        bytes32 b = keccak256("at");
        _boundaryDeal(b, 7000); // == threshold -> release
        escrow.settle(b);
        assertEq(uint8(escrow.getDeal(b).state), uint8(ISettlementEscrow.DealState.Released));
    }

    function test_Boundary_JustBelowThreshold_Disputes() public {
        bytes32 b = keccak256("below");
        _boundaryDeal(b, 6999); // just below -> dispute
        escrow.settle(b);
        assertEq(uint8(escrow.getDeal(b).state), uint8(ISettlementEscrow.DealState.Disputed));
    }

    function test_Boundary_JustAboveThreshold_Releases() public {
        bytes32 b = keccak256("above");
        _boundaryDeal(b, 7001); // just above -> release
        escrow.settle(b);
        assertEq(uint8(escrow.getDeal(b).state), uint8(ISettlementEscrow.DealState.Released));
    }

    // ---------------------------------------------------------------------
    // refund
    // ---------------------------------------------------------------------

    function test_Refund_HappyPath() public {
        _fund();
        _attest(5000); // fails -> Disputed
        escrow.settle(BATCH);

        vm.expectEmit(true, true, false, true);
        emit Refunded(BATCH, buyer, AMOUNT);
        vm.prank(admin);
        escrow.refund(BATCH);

        ISettlementEscrow.Deal memory d = escrow.getDeal(BATCH);
        assertEq(uint8(d.state), uint8(ISettlementEscrow.DealState.Refunded));
        assertEq(usdc.balanceOf(buyer), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_Refund_RevertsNotDisputed() public {
        _fund();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.NotDisputed.selector, BATCH));
        escrow.refund(BATCH);
    }

    function test_Refund_RevertsUnauthorized() public {
        _fund();
        _attest(5000);
        escrow.settle(BATCH);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        escrow.refund(BATCH);
    }

    // ---------------------------------------------------------------------
    // reentrancy
    // ---------------------------------------------------------------------

    function test_Settle_ReentrancyBlocked() public {
        ReentrantToken evil = new ReentrantToken();
        bytes32 b = keccak256("evil");

        vm.prank(supplier);
        prov.registerBatch(b, ORIGIN, "ipfs://meta");

        evil.mint(buyer, AMOUNT);
        vm.startPrank(buyer);
        evil.approve(address(escrow), AMOUNT);
        escrow.fund(b, supplier, address(evil), AMOUNT);
        vm.stopPrank();

        vm.prank(agent);
        att.attest(b, 9600, VHASH, "ipfs://verdict");

        // Arm the token to re-enter settle during the release transfer.
        evil.arm(escrow, b);

        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        escrow.settle(b);

        // Deal must remain Funded; no funds moved.
        assertEq(uint8(escrow.getDeal(b).state), uint8(ISettlementEscrow.DealState.Funded));
        assertEq(evil.balanceOf(supplier), 0);
        assertEq(evil.balanceOf(address(escrow)), AMOUNT);
    }
}
