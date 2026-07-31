// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { DigitalProductPassport } from "../../src/dpp/DigitalProductPassport.sol";
import { RecyclingRegistry } from "../../src/dpp/RecyclingRegistry.sol";
import { DPPLifecycleRegistry } from "../../src/dpp/DPPLifecycleRegistry.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IRecyclingRegistry } from "../../src/interfaces/IRecyclingRegistry.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract RecyclingRegistryTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    DigitalProductPassport internal dpp;
    DPPLifecycleRegistry internal lifecycle;
    RecyclingRegistry internal recycling;

    address internal admin = address(0xA11CE);
    address internal manufacturer = address(0xBEEF);
    address internal recycler = address(0x2EC1);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant REC = keccak256("record-1");
    bytes32 internal constant FACILITY = keccak256("facility-1");
    uint256 internal tokenId;

    event Collected(bytes32 indexed recordId, uint256 indexed tokenId, address indexed recycler, uint256 inputMassGrams);
    event Processing(bytes32 indexed recordId);
    event Recovered(bytes32 indexed recordId, uint256 recoveredMassGrams, uint16 recoveryRateBps);
    event Disposed(bytes32 indexed recordId, uint256 residualMassGrams);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        dpp = new DigitalProductPassport(address(book), admin);
        lifecycle = new DPPLifecycleRegistry(address(book), admin);
        recycling = new RecyclingRegistry(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        book.setAddress(Keys.DIGITAL_PRODUCT_PASSPORT, address(dpp));
        book.setAddress(Keys.DPP_LIFECYCLE_REGISTRY, address(lifecycle));
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerBatch(BATCH, keccak256("origin"), "ipfs://m");
        tokenId = dpp.issue(BATCH, keccak256("gtin"), manufacturer, "ipfs://doc");
        recycling.grantRole(Roles.CERTIFIER_ROLE, recycler);
        // Let the recycling registry stamp lifecycle events on recovery.
        lifecycle.grantRole(Roles.REGISTRAR_ROLE, address(recycling));
        vm.stopPrank();
    }

    function _collect() internal {
        vm.prank(recycler);
        recycling.recordCollection(REC, tokenId, 1000, FACILITY);
    }

    function test_FullLifecycle_ToRecovered() public {
        vm.expectEmit(true, true, true, true, address(recycling));
        emit Collected(REC, tokenId, recycler, 1000);
        _collect();
        assertEq(uint8(recycling.recordOf(REC).state), uint8(IRecyclingRegistry.RecycleState.Collected));

        vm.expectEmit(true, false, false, false, address(recycling));
        emit Processing(REC);
        vm.prank(recycler);
        recycling.startProcessing(REC);

        // recovered 850/1000 => 8500 bps
        vm.expectEmit(true, false, false, true, address(recycling));
        emit Recovered(REC, 850, 8500);
        vm.prank(recycler);
        recycling.recordRecovery(REC, 850);

        IRecyclingRegistry.RecycleRecord memory r = recycling.recordOf(REC);
        assertEq(uint8(r.state), uint8(IRecyclingRegistry.RecycleState.Recovered));
        assertEq(r.recoveredMassGrams, 850);

        // Lifecycle registry was stamped with a Recycled event.
        assertEq(lifecycle.eventCount(tokenId), 1);
    }

    function test_Recovery_StampSkippedWhenRoleMissing() public {
        // Revoke the registrar role; the best-effort lifecycle stamp reverts internally and is
        // swallowed, but the recovery record itself must still be committed.
        vm.prank(admin);
        lifecycle.revokeRole(Roles.REGISTRAR_ROLE, address(recycling));

        _collect();
        vm.startPrank(recycler);
        recycling.startProcessing(REC);
        recycling.recordRecovery(REC, 500);
        vm.stopPrank();
        assertEq(uint8(recycling.recordOf(REC).state), uint8(IRecyclingRegistry.RecycleState.Recovered));
        assertEq(lifecycle.eventCount(tokenId), 0);
    }

    function test_Disposal_AfterRecovery() public {
        _collect();
        vm.startPrank(recycler);
        recycling.startProcessing(REC);
        recycling.recordRecovery(REC, 900);
        vm.expectEmit(true, false, false, true, address(recycling));
        emit Disposed(REC, 100);
        recycling.recordDisposal(REC, 100);
        vm.stopPrank();
        assertEq(uint8(recycling.recordOf(REC).state), uint8(IRecyclingRegistry.RecycleState.Disposed));
    }

    function test_Disposal_WithoutRecovery() public {
        _collect();
        vm.prank(recycler);
        recycling.recordDisposal(REC, 1000);
        assertEq(uint8(recycling.recordOf(REC).state), uint8(IRecyclingRegistry.RecycleState.Disposed));
    }

    function test_RevertWhen_DuplicateRecord() public {
        _collect();
        vm.prank(recycler);
        vm.expectRevert(abi.encodeWithSelector(IRecyclingRegistry.RecordExists.selector, REC));
        recycling.recordCollection(REC, tokenId, 500, FACILITY);
    }

    function test_RevertWhen_ZeroMassCollection() public {
        vm.prank(recycler);
        vm.expectRevert(IRecyclingRegistry.ZeroMass.selector);
        recycling.recordCollection(REC, tokenId, 0, FACILITY);
    }

    function test_RevertWhen_UnknownPassport() public {
        vm.prank(recycler);
        vm.expectRevert(abi.encodeWithSelector(IRecyclingRegistry.UnknownPassport.selector, uint256(99)));
        recycling.recordCollection(REC, 99, 1000, FACILITY);
    }

    function test_RevertWhen_ProcessWrongState() public {
        _collect();
        vm.startPrank(recycler);
        recycling.startProcessing(REC);
        // Already processing; startProcessing expects Collected.
        vm.expectRevert(
            abi.encodeWithSelector(
                IRecyclingRegistry.InvalidState.selector,
                REC,
                IRecyclingRegistry.RecycleState.Collected,
                IRecyclingRegistry.RecycleState.Processing
            )
        );
        recycling.startProcessing(REC);
        vm.stopPrank();
    }

    function test_RevertWhen_RecoverBeforeProcessing() public {
        _collect();
        vm.prank(recycler);
        vm.expectRevert(
            abi.encodeWithSelector(
                IRecyclingRegistry.InvalidState.selector,
                REC,
                IRecyclingRegistry.RecycleState.Processing,
                IRecyclingRegistry.RecycleState.Collected
            )
        );
        recycling.recordRecovery(REC, 500);
    }

    function test_RevertWhen_RecoveredExceedsInput() public {
        _collect();
        vm.startPrank(recycler);
        recycling.startProcessing(REC);
        vm.expectRevert(abi.encodeWithSelector(IRecyclingRegistry.RecoveredExceedsInput.selector, uint256(1001), uint256(1000)));
        recycling.recordRecovery(REC, 1001);
        vm.stopPrank();
    }

    function test_RevertWhen_ZeroRecovery() public {
        _collect();
        vm.startPrank(recycler);
        recycling.startProcessing(REC);
        vm.expectRevert(IRecyclingRegistry.ZeroMass.selector);
        recycling.recordRecovery(REC, 0);
        vm.stopPrank();
    }

    function test_RevertWhen_UnknownRecord() public {
        vm.prank(recycler);
        vm.expectRevert(abi.encodeWithSelector(IRecyclingRegistry.UnknownRecord.selector, bytes32("nope")));
        recycling.startProcessing(bytes32("nope"));
    }

    function test_RevertWhen_DisposeTwice() public {
        _collect();
        vm.startPrank(recycler);
        recycling.recordDisposal(REC, 1000);
        vm.expectRevert(
            abi.encodeWithSelector(
                IRecyclingRegistry.InvalidState.selector,
                REC,
                IRecyclingRegistry.RecycleState.Recovered,
                IRecyclingRegistry.RecycleState.Disposed
            )
        );
        recycling.recordDisposal(REC, 0);
        vm.stopPrank();
    }

    function test_RevertWhen_NonCertifierCollects() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CERTIFIER_ROLE)
        );
        recycling.recordCollection(REC, tokenId, 1000, FACILITY);
    }
}
