// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ContainerRegistry } from "../../src/logistics/ContainerRegistry.sol";
import { IContainerRegistry } from "../../src/interfaces/IContainerRegistry.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract ContainerRegistryTest is Test {
    AddressBook internal book;
    ContainerRegistry internal cr;

    address internal admin = address(0xA11CE);
    address internal owner = address(0x0117E9);
    address internal newOwner = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant CONT = keccak256("MSCU1234567");
    bytes32 internal constant ISO = keccak256("22G1");
    bytes32 internal constant BOOKING = keccak256("booking-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant SEAL = keccak256("seal-1");
    uint32 internal constant TARE = 2_200;
    uint32 internal constant MAXG = 30_480;

    event ContainerRegistered(bytes32 indexed containerId, address indexed owner, bytes32 isoType, uint32 tareKg);
    event ContainerAssigned(bytes32 indexed containerId, bytes32 indexed bookingId);
    event ContainerSealed(bytes32 indexed containerId, bytes32 indexed batchId, bytes32 sealId);
    event StatusChanged(bytes32 indexed containerId, IContainerRegistry.ContainerStatus status);
    event OwnerChanged(bytes32 indexed containerId, address indexed newOwner);
    event ContainerRetired(bytes32 indexed containerId);

    function setUp() public {
        book = new AddressBook(admin);
        cr = new ContainerRegistry(address(book), admin);
    }

    function _register() internal {
        vm.prank(owner);
        cr.registerContainer(CONT, owner, ISO, TARE, MAXG);
    }

    // ---------------------------------------------------------------- register

    function test_Register_Happy() public {
        vm.expectEmit(true, true, false, true);
        emit ContainerRegistered(CONT, owner, ISO, TARE);
        _register();

        IContainerRegistry.Container memory c = cr.containerOf(CONT);
        assertEq(c.owner, owner);
        assertEq(uint8(c.status), uint8(IContainerRegistry.ContainerStatus.Available));
        assertEq(c.maxGrossKg, MAXG);
    }

    function test_Register_ByRegistrar() public {
        vm.prank(admin);
        cr.grantRole(Roles.REGISTRAR_ROLE, stranger);
        vm.prank(stranger);
        cr.registerContainer(CONT, owner, ISO, TARE, MAXG);
        assertEq(cr.containerOf(CONT).owner, owner);
    }

    function test_Revert_Register_NotOwnerNorRegistrar() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IContainerRegistry.NotOwner.selector, CONT));
        cr.registerContainer(CONT, owner, ISO, TARE, MAXG);
    }

    function test_Revert_Register_InvalidWeights() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IContainerRegistry.InvalidWeights.selector, MAXG, TARE));
        cr.registerContainer(CONT, owner, ISO, MAXG, TARE); // tare >= gross
    }

    function test_Revert_Register_ZeroOwner() public {
        vm.prank(owner);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        cr.registerContainer(CONT, address(0), ISO, TARE, MAXG);
    }

    function test_Revert_Register_Exists() public {
        _register();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IContainerRegistry.ContainerExists.selector, CONT));
        cr.registerContainer(CONT, owner, ISO, TARE, MAXG);
    }

    // ---------------------------------------------------------------- lifecycle

    function test_AssignSealTransit_Discharge() public {
        _register();

        vm.expectEmit(true, true, false, false);
        emit ContainerAssigned(CONT, BOOKING);
        vm.prank(owner);
        cr.assign(CONT, BOOKING);
        assertEq(uint8(cr.containerOf(CONT).status), uint8(IContainerRegistry.ContainerStatus.Assigned));

        vm.expectEmit(true, true, false, true);
        emit ContainerSealed(CONT, BATCH, SEAL);
        vm.prank(owner);
        cr.seal(CONT, BATCH, SEAL);
        IContainerRegistry.Container memory c = cr.containerOf(CONT);
        assertEq(uint8(c.status), uint8(IContainerRegistry.ContainerStatus.Sealed));
        assertEq(c.sealId, SEAL);
        assertEq(c.batchId, BATCH);

        vm.prank(owner);
        cr.setStatus(CONT, IContainerRegistry.ContainerStatus.InTransit);
        assertEq(uint8(cr.containerOf(CONT).status), uint8(IContainerRegistry.ContainerStatus.InTransit));

        vm.prank(owner);
        cr.setStatus(CONT, IContainerRegistry.ContainerStatus.Discharged);
        assertEq(uint8(cr.containerOf(CONT).status), uint8(IContainerRegistry.ContainerStatus.Discharged));
    }

    function test_Revert_Assign_NotOwner() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IContainerRegistry.NotOwner.selector, CONT));
        cr.assign(CONT, BOOKING);
    }

    function test_Revert_Seal_NotAssigned() public {
        _register();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IContainerRegistry.InvalidStatus.selector, CONT, IContainerRegistry.ContainerStatus.Assigned, IContainerRegistry.ContainerStatus.Available
            )
        );
        cr.seal(CONT, BATCH, SEAL);
    }

    function test_Revert_Seal_ZeroSeal() public {
        _register();
        vm.prank(owner);
        cr.assign(CONT, BOOKING);
        vm.prank(owner);
        vm.expectRevert(IContainerRegistry.ZeroSeal.selector);
        cr.seal(CONT, BATCH, bytes32(0));
    }

    function test_Revert_SetStatus_SkipTransit() public {
        _register();
        vm.prank(owner);
        cr.assign(CONT, BOOKING);
        vm.prank(owner);
        cr.seal(CONT, BATCH, SEAL);
        // cannot jump Sealed -> Discharged without InTransit
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IContainerRegistry.InvalidStatus.selector, CONT, IContainerRegistry.ContainerStatus.InTransit, IContainerRegistry.ContainerStatus.Sealed
            )
        );
        cr.setStatus(CONT, IContainerRegistry.ContainerStatus.Discharged);
    }

    function test_Revert_SetStatus_InvalidTarget() public {
        _register();
        vm.prank(owner);
        cr.assign(CONT, BOOKING);
        vm.prank(owner);
        cr.seal(CONT, BATCH, SEAL);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IContainerRegistry.InvalidStatus.selector, CONT, IContainerRegistry.ContainerStatus.InTransit, IContainerRegistry.ContainerStatus.Available
            )
        );
        cr.setStatus(CONT, IContainerRegistry.ContainerStatus.Available);
    }

    // ---------------------------------------------------------------- owner / retire

    function test_TransferOwner() public {
        _register();
        vm.expectEmit(true, true, false, false);
        emit OwnerChanged(CONT, newOwner);
        vm.prank(owner);
        cr.transferOwner(CONT, newOwner);
        assertEq(cr.containerOf(CONT).owner, newOwner);

        // old owner can no longer act
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IContainerRegistry.NotOwner.selector, CONT));
        cr.assign(CONT, BOOKING);
    }

    function test_Retire() public {
        _register();
        vm.expectEmit(true, false, false, false);
        emit ContainerRetired(CONT);
        vm.prank(owner);
        cr.retire(CONT);
        assertEq(uint8(cr.containerOf(CONT).status), uint8(IContainerRegistry.ContainerStatus.Retired));
    }

    function test_Revert_UnknownContainer() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IContainerRegistry.UnknownContainer.selector, CONT));
        cr.assign(CONT, BOOKING);
    }
}
