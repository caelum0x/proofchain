// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { FleetRegistry } from "../../src/logistics/FleetRegistry.sol";
import { IFleetRegistry } from "../../src/interfaces/IFleetRegistry.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract FleetRegistryTest is Test {
    AddressBook internal book;
    FleetRegistry internal fleet;

    address internal admin = address(0xA11CE);
    address internal carrier = address(0xCA44);
    address internal device = address(0xD3);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant ASSET = keccak256("asset-1");
    uint256 internal constant CAP = 20_000;

    event AssetRegistered(bytes32 indexed assetId, address indexed carrier, IFleetRegistry.AssetType assetType, uint256 capacityKg);
    event DeviceKeySet(bytes32 indexed assetId, address indexed deviceKey);
    event AssetStateChanged(bytes32 indexed assetId, IFleetRegistry.AssetState state);

    function setUp() public {
        book = new AddressBook(admin);
        fleet = new FleetRegistry(address(book), admin);
    }

    function _register() internal {
        vm.prank(carrier);
        fleet.registerAsset(ASSET, carrier, IFleetRegistry.AssetType.Reefer, CAP, 3);
    }

    // ---------------------------------------------------------------- register

    function test_Register_ByCarrier_Happy() public {
        vm.expectEmit(true, true, false, true);
        emit AssetRegistered(ASSET, carrier, IFleetRegistry.AssetType.Reefer, CAP);
        _register();

        IFleetRegistry.Asset memory a = fleet.assetOf(ASSET);
        assertEq(a.carrier, carrier);
        assertEq(a.capacityKg, CAP);
        assertEq(uint8(a.state), uint8(IFleetRegistry.AssetState.Active));
    }

    function test_Register_ByRegistrar() public {
        vm.prank(admin);
        fleet.grantRole(Roles.REGISTRAR_ROLE, stranger);
        vm.prank(stranger);
        fleet.registerAsset(ASSET, carrier, IFleetRegistry.AssetType.Truck, CAP, 1);
        assertEq(fleet.assetOf(ASSET).carrier, carrier);
    }

    function test_Revert_Register_NotCarrierNorRegistrar() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IFleetRegistry.NotCarrier.selector, ASSET));
        fleet.registerAsset(ASSET, carrier, IFleetRegistry.AssetType.Truck, CAP, 1);
    }

    function test_Revert_Register_ZeroCapacity() public {
        vm.prank(carrier);
        vm.expectRevert(IFleetRegistry.ZeroCapacity.selector);
        fleet.registerAsset(ASSET, carrier, IFleetRegistry.AssetType.Truck, 0, 1);
    }

    function test_Revert_Register_ZeroCarrier() public {
        vm.prank(carrier);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        fleet.registerAsset(ASSET, address(0), IFleetRegistry.AssetType.Truck, CAP, 1);
    }

    function test_Revert_Register_Exists() public {
        _register();
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(IFleetRegistry.AssetExists.selector, ASSET));
        fleet.registerAsset(ASSET, carrier, IFleetRegistry.AssetType.Truck, CAP, 1);
    }

    // ---------------------------------------------------------------- device key

    function test_SetDeviceKey_AndActiveDevice() public {
        _register();
        vm.expectEmit(true, true, false, false);
        emit DeviceKeySet(ASSET, device);
        vm.prank(carrier);
        fleet.setDeviceKey(ASSET, device);

        assertEq(fleet.assetOf(ASSET).deviceKey, device);
        assertTrue(fleet.isActiveDevice(ASSET, device));
        assertFalse(fleet.isActiveDevice(ASSET, stranger));
        assertFalse(fleet.isActiveDevice(ASSET, address(0)));
    }

    function test_Revert_SetDeviceKey_NotController() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IFleetRegistry.NotCarrier.selector, ASSET));
        fleet.setDeviceKey(ASSET, device);
    }

    // ---------------------------------------------------------------- lifecycle

    function test_Maintenance_Reactivate() public {
        _register();
        vm.prank(carrier);
        fleet.setDeviceKey(ASSET, device);

        vm.expectEmit(true, false, false, true);
        emit AssetStateChanged(ASSET, IFleetRegistry.AssetState.Maintenance);
        vm.prank(carrier);
        fleet.setMaintenance(ASSET);
        assertEq(uint8(fleet.assetOf(ASSET).state), uint8(IFleetRegistry.AssetState.Maintenance));
        // device inactive while in maintenance
        assertFalse(fleet.isActiveDevice(ASSET, device));

        vm.prank(carrier);
        fleet.reactivate(ASSET);
        assertEq(uint8(fleet.assetOf(ASSET).state), uint8(IFleetRegistry.AssetState.Active));
        assertTrue(fleet.isActiveDevice(ASSET, device));
    }

    function test_Revert_Reactivate_NotInMaintenance() public {
        _register();
        vm.prank(carrier);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFleetRegistry.InvalidState.selector, ASSET, IFleetRegistry.AssetState.Maintenance, IFleetRegistry.AssetState.Active
            )
        );
        fleet.reactivate(ASSET);
    }

    function test_Decommission_Terminal() public {
        _register();
        vm.prank(carrier);
        fleet.decommission(ASSET);
        assertEq(uint8(fleet.assetOf(ASSET).state), uint8(IFleetRegistry.AssetState.Decommissioned));

        // cannot set device key on a decommissioned asset
        vm.prank(carrier);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFleetRegistry.InvalidState.selector,
                ASSET,
                IFleetRegistry.AssetState.Active,
                IFleetRegistry.AssetState.Decommissioned
            )
        );
        fleet.setDeviceKey(ASSET, device);
    }

    function test_Revert_SetMaintenance_UnknownAsset() public {
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(IFleetRegistry.UnknownAsset.selector, ASSET));
        fleet.setMaintenance(ASSET);
    }
}
