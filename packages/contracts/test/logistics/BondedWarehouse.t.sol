// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { BondedWarehouse } from "../../src/logistics/BondedWarehouse.sol";
import { IBondedWarehouse } from "../../src/interfaces/IBondedWarehouse.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract BondedWarehouseTest is Test {
    AddressBook internal book;
    BondedWarehouse internal bw;

    address internal admin = address(0xA11CE);
    address internal customs = address(0xC057);
    address internal operator = address(0x0FE9);
    address internal owner = address(0x0117E9);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant WH = keccak256("wh-1");
    bytes32 internal constant BOND = keccak256("bond-1");
    bytes32 internal constant LOC = keccak256("NLRTM-bond");
    bytes32 internal constant LOT = keccak256("lot-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    uint256 internal constant QTY = 100;

    event WarehouseRegistered(bytes32 indexed warehouseId, address indexed operator, bytes32 customsBondId, bytes32 location);
    event Deposited(bytes32 indexed lotId, bytes32 indexed warehouseId, bytes32 indexed batchId, address owner, uint256 quantity);
    event DutyPaid(bytes32 indexed lotId);
    event ReExported(bytes32 indexed lotId);
    event Released(bytes32 indexed lotId);

    function setUp() public {
        book = new AddressBook(admin);
        bw = new BondedWarehouse(address(book), admin);
        vm.prank(admin);
        bw.grantRole(Roles.CUSTOMS_ROLE, customs);
    }

    function _registerWarehouse() internal {
        vm.prank(customs);
        bw.registerWarehouse(WH, operator, BOND, LOC);
    }

    function _deposit() internal {
        vm.prank(operator);
        bw.deposit(LOT, WH, BATCH, owner, QTY);
    }

    // ---------------------------------------------------------------- warehouse

    function test_RegisterWarehouse_Happy() public {
        vm.expectEmit(true, true, false, true);
        emit WarehouseRegistered(WH, operator, BOND, LOC);
        _registerWarehouse();

        IBondedWarehouse.Warehouse memory w = bw.warehouseOf(WH);
        assertEq(w.operator, operator);
        assertEq(w.customsBondId, BOND);
        assertTrue(w.active);
    }

    function test_Revert_RegisterWarehouse_NotCustoms() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CUSTOMS_ROLE)
        );
        bw.registerWarehouse(WH, operator, BOND, LOC);
    }

    function test_Revert_RegisterWarehouse_ZeroOperator() public {
        vm.prank(customs);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        bw.registerWarehouse(WH, address(0), BOND, LOC);
    }

    function test_Revert_RegisterWarehouse_Exists() public {
        _registerWarehouse();
        vm.prank(customs);
        vm.expectRevert(abi.encodeWithSelector(IBondedWarehouse.WarehouseExists.selector, WH));
        bw.registerWarehouse(WH, operator, BOND, LOC);
    }

    function test_DeactivateWarehouse_ByOperator() public {
        _registerWarehouse();
        vm.prank(operator);
        bw.deactivateWarehouse(WH);
        assertFalse(bw.warehouseOf(WH).active);
    }

    // ---------------------------------------------------------------- deposit

    function test_Deposit_Happy() public {
        _registerWarehouse();
        vm.expectEmit(true, true, true, true);
        emit Deposited(LOT, WH, BATCH, owner, QTY);
        _deposit();

        IBondedWarehouse.BondedLot memory lot = bw.lotOf(LOT);
        assertEq(uint8(lot.state), uint8(IBondedWarehouse.LotState.Bonded));
        assertEq(lot.owner, owner);
        assertEq(lot.quantity, QTY);
    }

    function test_Revert_Deposit_NotOperator() public {
        _registerWarehouse();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IBondedWarehouse.NotOperator.selector, WH));
        bw.deposit(LOT, WH, BATCH, owner, QTY);
    }

    function test_Revert_Deposit_ZeroQuantity() public {
        _registerWarehouse();
        vm.prank(operator);
        vm.expectRevert(IBondedWarehouse.ZeroQuantity.selector);
        bw.deposit(LOT, WH, BATCH, owner, 0);
    }

    function test_Revert_Deposit_InactiveWarehouse() public {
        _registerWarehouse();
        vm.prank(operator);
        bw.deactivateWarehouse(WH);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(IBondedWarehouse.WarehouseInactive.selector, WH));
        bw.deposit(LOT, WH, BATCH, owner, QTY);
    }

    function test_Revert_Deposit_LotExists() public {
        _registerWarehouse();
        _deposit();
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(IBondedWarehouse.LotExists.selector, LOT));
        bw.deposit(LOT, WH, BATCH, owner, QTY);
    }

    // ---------------------------------------------------------------- clearance flows

    function test_ClearForHomeUse_ThenRelease() public {
        _registerWarehouse();
        _deposit();

        vm.expectEmit(true, false, false, false);
        emit DutyPaid(LOT);
        vm.prank(customs);
        bw.clearForHomeUse(LOT);
        assertEq(uint8(bw.lotOf(LOT).state), uint8(IBondedWarehouse.LotState.DutyPaid));

        vm.expectEmit(true, false, false, false);
        emit Released(LOT);
        vm.prank(operator);
        bw.release(LOT);
        assertEq(uint8(bw.lotOf(LOT).state), uint8(IBondedWarehouse.LotState.Released));
    }

    function test_ReExport_ThenRelease() public {
        _registerWarehouse();
        _deposit();

        vm.expectEmit(true, false, false, false);
        emit ReExported(LOT);
        vm.prank(customs);
        bw.reExport(LOT);
        assertEq(uint8(bw.lotOf(LOT).state), uint8(IBondedWarehouse.LotState.ReExported));

        vm.prank(customs);
        bw.release(LOT);
        assertEq(uint8(bw.lotOf(LOT).state), uint8(IBondedWarehouse.LotState.Released));
    }

    function test_Revert_ClearForHomeUse_NotCustoms() public {
        _registerWarehouse();
        _deposit();
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, operator, Roles.CUSTOMS_ROLE)
        );
        bw.clearForHomeUse(LOT);
    }

    function test_Revert_ClearForHomeUse_WrongState() public {
        _registerWarehouse();
        _deposit();
        vm.prank(customs);
        bw.clearForHomeUse(LOT);
        // already DutyPaid -> cannot clear again
        vm.prank(customs);
        vm.expectRevert(
            abi.encodeWithSelector(
                IBondedWarehouse.InvalidState.selector, LOT, IBondedWarehouse.LotState.Bonded, IBondedWarehouse.LotState.DutyPaid
            )
        );
        bw.clearForHomeUse(LOT);
    }

    function test_Revert_Release_StillBonded() public {
        _registerWarehouse();
        _deposit();
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                IBondedWarehouse.InvalidState.selector, LOT, IBondedWarehouse.LotState.DutyPaid, IBondedWarehouse.LotState.Bonded
            )
        );
        bw.release(LOT);
    }

    function test_Revert_UnknownLot() public {
        _registerWarehouse();
        vm.prank(customs);
        vm.expectRevert(abi.encodeWithSelector(IBondedWarehouse.UnknownLot.selector, LOT));
        bw.clearForHomeUse(LOT);
    }
}
