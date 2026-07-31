// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { IoTSensorRegistry } from "../../src/data/IoTSensorRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IIoTSensorRegistry } from "../../src/interfaces/IIoTSensorRegistry.sol";

contract IoTSensorRegistryTest is Test {
    AddressBook internal book;
    IoTSensorRegistry internal reg;

    address internal admin = address(0xA11CE);
    address internal registrar = address(0x4E6);
    address internal keeper = address(0x33D);
    address internal owner = address(0x0117E4);
    address internal stranger = address(0xDEAD);
    address internal deviceKey = address(0xD3711CE);
    address internal newKey = address(0xBEEF);

    bytes32 internal constant S1 = keccak256("sensor-1");
    bytes32 internal constant ASSET = keccak256("batch-1");
    bytes32 internal constant META = keccak256("meta");

    event SensorRegistered(
        bytes32 indexed sensorId, address indexed owner, address indexed deviceKey, IIoTSensorRegistry.SensorType sensorType
    );
    event SensorCommissioned(bytes32 indexed sensorId, bytes32 assetId);
    event DeviceKeyRotated(bytes32 indexed sensorId, address indexed oldKey, address indexed newKey);

    function setUp() public {
        book = new AddressBook(admin);
        reg = new IoTSensorRegistry(address(book), admin);
        vm.startPrank(admin);
        reg.grantRole(Roles.REGISTRAR_ROLE, registrar);
        reg.grantRole(Roles.KEEPER_ROLE, keeper);
        vm.stopPrank();
    }

    function _register() internal {
        vm.prank(owner);
        reg.registerSensor(S1, owner, deviceKey, IIoTSensorRegistry.SensorType.Temperature, META);
    }

    function test_Register_ByOwner_HappyPath() public {
        vm.expectEmit(true, true, true, true, address(reg));
        emit SensorRegistered(S1, owner, deviceKey, IIoTSensorRegistry.SensorType.Temperature);
        _register();

        IIoTSensorRegistry.Sensor memory s = reg.sensorOf(S1);
        assertEq(s.owner, owner);
        assertEq(s.deviceKey, deviceKey);
        assertEq(uint8(s.status), uint8(IIoTSensorRegistry.SensorStatus.Registered));
        assertEq(reg.sensorOfDevice(deviceKey), S1);
    }

    function test_Register_ByRegistrar_ForOwner() public {
        vm.prank(registrar);
        reg.registerSensor(S1, owner, deviceKey, IIoTSensorRegistry.SensorType.Gps, META);
        assertEq(reg.sensorOf(S1).owner, owner);
    }

    function test_RevertWhen_NonOwnerNonRegistrarRegisters() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IIoTSensorRegistry.NotOwner.selector, S1));
        reg.registerSensor(S1, owner, deviceKey, IIoTSensorRegistry.SensorType.Gps, META);
    }

    function test_RevertWhen_ZeroDeviceKey() public {
        vm.prank(owner);
        vm.expectRevert(IIoTSensorRegistry.ZeroDeviceKey.selector);
        reg.registerSensor(S1, owner, address(0), IIoTSensorRegistry.SensorType.Gps, META);
    }

    function test_RevertWhen_DuplicateSensor() public {
        _register();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IIoTSensorRegistry.SensorExists.selector, S1));
        reg.registerSensor(S1, owner, address(0x1234), IIoTSensorRegistry.SensorType.Gps, META);
    }

    function test_RevertWhen_DeviceKeyInUse() public {
        _register();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IIoTSensorRegistry.DeviceKeyInUse.selector, deviceKey));
        reg.registerSensor(keccak256("sensor-2"), owner, deviceKey, IIoTSensorRegistry.SensorType.Gps, META);
    }

    function test_Commission_TrustsDevice() public {
        _register();
        assertFalse(reg.isTrustedDevice(S1, deviceKey));

        vm.expectEmit(true, false, false, true, address(reg));
        emit SensorCommissioned(S1, ASSET);
        vm.prank(owner);
        reg.commission(S1, ASSET);

        assertEq(uint8(reg.sensorOf(S1).status), uint8(IIoTSensorRegistry.SensorStatus.Commissioned));
        assertTrue(reg.isTrustedDevice(S1, deviceKey));
        assertFalse(reg.isTrustedDevice(S1, newKey));
    }

    function test_RevertWhen_CommissionByNonOwner() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IIoTSensorRegistry.NotOwner.selector, S1));
        reg.commission(S1, ASSET);
    }

    function test_RevertWhen_CommissionWrongStatus() public {
        _register();
        vm.startPrank(owner);
        reg.commission(S1, ASSET);
        vm.expectRevert(
            abi.encodeWithSelector(
                IIoTSensorRegistry.InvalidStatus.selector,
                S1,
                IIoTSensorRegistry.SensorStatus.Registered,
                IIoTSensorRegistry.SensorStatus.Commissioned
            )
        );
        reg.commission(S1, ASSET);
        vm.stopPrank();
    }

    function test_FlagCompromised_ByKeeper_UntrustsDevice() public {
        _register();
        vm.prank(owner);
        reg.commission(S1, ASSET);

        vm.prank(keeper);
        reg.flagCompromised(S1, keccak256("tamper"));

        assertEq(uint8(reg.sensorOf(S1).status), uint8(IIoTSensorRegistry.SensorStatus.Compromised));
        assertFalse(reg.isTrustedDevice(S1, deviceKey));
    }

    function test_RevertWhen_FlagCompromisedByStranger() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IIoTSensorRegistry.NotOwner.selector, S1));
        reg.flagCompromised(S1, keccak256("x"));
    }

    function test_Decommission_UntrustsDevice() public {
        _register();
        vm.startPrank(owner);
        reg.commission(S1, ASSET);
        reg.decommission(S1);
        vm.stopPrank();
        assertEq(uint8(reg.sensorOf(S1).status), uint8(IIoTSensorRegistry.SensorStatus.Decommissioned));
        assertFalse(reg.isTrustedDevice(S1, deviceKey));
    }

    function test_RotateDeviceKey_RemapsDevice() public {
        _register();
        vm.prank(owner);
        reg.commission(S1, ASSET);

        vm.expectEmit(true, true, true, true, address(reg));
        emit DeviceKeyRotated(S1, deviceKey, newKey);
        vm.prank(owner);
        reg.rotateDeviceKey(S1, newKey);

        assertEq(reg.sensorOfDevice(deviceKey), bytes32(0));
        assertEq(reg.sensorOfDevice(newKey), S1);
        assertTrue(reg.isTrustedDevice(S1, newKey));
        assertFalse(reg.isTrustedDevice(S1, deviceKey));
    }

    function test_RevertWhen_RotateToUsedKey() public {
        _register();
        // Register a second sensor holding `newKey`.
        vm.prank(owner);
        reg.registerSensor(keccak256("sensor-2"), owner, newKey, IIoTSensorRegistry.SensorType.Gps, META);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IIoTSensorRegistry.DeviceKeyInUse.selector, newKey));
        reg.rotateDeviceKey(S1, newKey);
    }

    function test_RevertWhen_RotateDecommissioned() public {
        _register();
        vm.startPrank(owner);
        reg.decommission(S1);
        vm.expectRevert(
            abi.encodeWithSelector(
                IIoTSensorRegistry.InvalidStatus.selector,
                S1,
                IIoTSensorRegistry.SensorStatus.Commissioned,
                IIoTSensorRegistry.SensorStatus.Decommissioned
            )
        );
        reg.rotateDeviceKey(S1, newKey);
        vm.stopPrank();
    }

    function test_RevertWhen_UnknownSensor() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IIoTSensorRegistry.UnknownSensor.selector, S1));
        reg.commission(S1, ASSET);
    }
}
