// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AttestationRegistry } from "../../src/AttestationRegistry.sol";
import { SettlementEscrow } from "../../src/SettlementEscrow.sol";
import { ISettlementEscrow } from "../../src/interfaces/ISettlementEscrow.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockReputationEngine } from "./mocks/MockReputationEngine.sol";

/// @notice Coverage for the SPEC2 M2 escrow extensions: payee override / setPayee,
///         ARBITER_ROLE arbiterRelease, and the optional ReputationEngine hook. The original
///         escrow behavior is covered by test/SettlementEscrow.t.sol and remains unchanged.
contract SettlementEscrowM2Test is Test {
    AddressBook internal book;
    ProvenanceRegistry internal prov;
    AttestationRegistry internal att;
    SettlementEscrow internal escrow;
    MockReputationEngine internal reputation;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal agent = address(0xA6E7);
    address internal supplier = address(0xB0B);
    address internal buyer = address(0xB111);
    address internal financier = address(0xF1);
    address internal arbiter = address(0xA7B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("origin");
    bytes32 internal constant VHASH = keccak256("verdict");
    uint256 internal constant AMOUNT = 1_000e6;

    event PayeeSet(bytes32 indexed batchId, address indexed payee);
    event Released(bytes32 indexed batchId, address indexed supplier, uint256 amount);
    event ArbiterReleased(bytes32 indexed batchId, address indexed payee, uint256 amount);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        prov = new ProvenanceRegistry(admin);
        att = new AttestationRegistry(admin, address(prov));
        escrow = new SettlementEscrow(admin, address(att), address(prov));
        reputation = new MockReputationEngine();

        att.grantRole(att.AGENT_ROLE(), agent);
        prov.grantRole(prov.REGISTRAR_ROLE(), supplier);
        escrow.grantRole(escrow.ARBITER_ROLE(), arbiter);
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

    // ---------------------------------------------------------------------
    // ARBITER_ROLE / payee views
    // ---------------------------------------------------------------------

    function test_ArbiterRole_MatchesRolesLibrary() public view {
        assertEq(escrow.ARBITER_ROLE(), Roles.ARBITER_ROLE);
    }

    function test_PayeeOverride_DefaultsToSupplier() public {
        _fund();
        assertEq(escrow.payeeOverride(BATCH), supplier);
    }

    // ---------------------------------------------------------------------
    // setPayee
    // ---------------------------------------------------------------------

    function test_SetPayee_HappyPath() public {
        _fund();
        vm.expectEmit(true, true, false, false);
        emit PayeeSet(BATCH, financier);
        vm.prank(supplier);
        escrow.setPayee(BATCH, financier);
        assertEq(escrow.payeeOverride(BATCH), financier);
    }

    function test_SetPayee_RevertsNotSupplier() public {
        _fund();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.NotSupplier.selector, BATCH));
        escrow.setPayee(BATCH, financier);
    }

    function test_SetPayee_RevertsZeroPayee() public {
        _fund();
        vm.prank(supplier);
        vm.expectRevert(ISettlementEscrow.ZeroAddress.selector);
        escrow.setPayee(BATCH, address(0));
    }

    function test_SetPayee_RevertsWhenNotFundedState() public {
        // No deal yet: supplier is address(0), so caller != supplier -> NotSupplier first.
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.NotSupplier.selector, BATCH));
        escrow.setPayee(BATCH, financier);
    }

    function test_SetPayee_RevertsAfterRelease() public {
        _fund();
        _attest(9600);
        escrow.settle(BATCH); // Released
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.NotFundedState.selector, BATCH));
        escrow.setPayee(BATCH, financier);
    }

    // ---------------------------------------------------------------------
    // settle pays the override
    // ---------------------------------------------------------------------

    function test_Settle_PaysOverridePayee() public {
        _fund();
        vm.prank(supplier);
        escrow.setPayee(BATCH, financier);
        _attest(9600);

        vm.expectEmit(true, true, false, true);
        emit Released(BATCH, financier, AMOUNT);
        escrow.settle(BATCH);

        assertEq(usdc.balanceOf(financier), AMOUNT);
        assertEq(usdc.balanceOf(supplier), 0);
    }

    // ---------------------------------------------------------------------
    // arbiterRelease
    // ---------------------------------------------------------------------

    function test_ArbiterRelease_HappyPath() public {
        _fund();
        _attest(4000); // fails -> Disputed
        escrow.settle(BATCH);

        vm.expectEmit(true, true, false, true);
        emit ArbiterReleased(BATCH, supplier, AMOUNT);
        vm.prank(arbiter);
        escrow.arbiterRelease(BATCH);

        assertEq(uint8(escrow.getDeal(BATCH).state), uint8(ISettlementEscrow.DealState.Released));
        assertEq(usdc.balanceOf(supplier), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_ArbiterRelease_PaysOverridePayee() public {
        _fund();
        vm.prank(supplier);
        escrow.setPayee(BATCH, financier);
        _attest(4000);
        escrow.settle(BATCH); // Disputed

        vm.prank(arbiter);
        escrow.arbiterRelease(BATCH);
        assertEq(usdc.balanceOf(financier), AMOUNT);
        assertEq(usdc.balanceOf(supplier), 0);
    }

    function test_ArbiterRelease_RevertsNotDisputed() public {
        _fund();
        vm.prank(arbiter);
        vm.expectRevert(abi.encodeWithSelector(ISettlementEscrow.NotDisputed.selector, BATCH));
        escrow.arbiterRelease(BATCH);
    }

    function test_ArbiterRelease_RevertsUnauthorized() public {
        _fund();
        _attest(4000);
        escrow.settle(BATCH);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.ARBITER_ROLE
            )
        );
        escrow.arbiterRelease(BATCH);
    }

    // ---------------------------------------------------------------------
    // reputation hook
    // ---------------------------------------------------------------------

    function test_ReputationHook_RecordsOnReleaseWhenWired() public {
        vm.prank(admin);
        escrow.setAddressBook(address(book));
        _fund();
        _attest(9600);
        escrow.settle(BATCH);

        (address recSupplier, bool passed, uint16 score) = reputation.last();
        assertEq(recSupplier, supplier);
        assertTrue(passed);
        assertEq(score, 9600);
        assertEq(reputation.calls(), 1);
    }

    function test_ReputationHook_RecordsDisputeOutcome() public {
        vm.prank(admin);
        escrow.setAddressBook(address(book));
        _fund();
        _attest(4000);
        escrow.settle(BATCH);

        (, bool passed,) = reputation.last();
        assertFalse(passed);
        assertEq(reputation.calls(), 1);
    }

    function test_ReputationHook_NoOpWhenAddressBookUnset() public {
        // Default: no AddressBook wired -> settle must not touch the engine.
        _fund();
        _attest(9600);
        escrow.settle(BATCH);
        assertEq(reputation.calls(), 0);
        assertEq(usdc.balanceOf(supplier), AMOUNT);
    }

    function test_ReputationHook_GracefulWhenEngineReverts() public {
        vm.prank(admin);
        escrow.setAddressBook(address(book));
        reputation.setShouldRevert(true);
        _fund();
        _attest(9600);
        // Settlement must not brick even though the reputation engine reverts.
        escrow.settle(BATCH);
        assertEq(usdc.balanceOf(supplier), AMOUNT);
        assertEq(reputation.calls(), 0);
    }

    function test_SetAddressBook_RevertsZero() public {
        vm.prank(admin);
        vm.expectRevert(ISettlementEscrow.ZeroAddress.selector);
        escrow.setAddressBook(address(0));
    }

    function test_SetAddressBook_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        escrow.setAddressBook(address(book));
    }
}
