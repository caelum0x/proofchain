// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { BillOfExchange } from "../../src/tradefinance/BillOfExchange.sol";
import { IBillOfExchange } from "../../src/interfaces/IBillOfExchange.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract BillOfExchangeTest is Test {
    AddressBook internal book;
    BillOfExchange internal boe;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal drawer = address(0xD4A0);
    address internal drawee = address(0xD4EE); // acceptor / payer
    address internal payee = address(0xB0B);
    address internal newHolder = address(0xC0FFEE);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BILL = keccak256("bill-1");
    uint256 internal constant AMOUNT = 500e6;
    uint64 internal maturity;

    function setUp() public {
        vm.prank(admin);
        book = new AddressBook(admin);
        boe = new BillOfExchange(address(book), admin);
        usdc = new MockUSDC();

        usdc.mint(drawee, AMOUNT * 10);
        vm.prank(drawee);
        usdc.approve(address(boe), type(uint256).max);

        maturity = uint64(block.timestamp + 30 days);
    }

    function _draw(bool sight) internal {
        vm.prank(drawer);
        boe.draw(BILL, drawee, payee, address(usdc), AMOUNT, maturity, sight);
    }

    function test_Draw_Happy() public {
        _draw(false);
        IBillOfExchange.Bill memory b = boe.billOf(BILL);
        assertEq(uint8(b.state), uint8(IBillOfExchange.BillState.Drawn));
        assertEq(b.drawer, drawer);
        assertEq(b.drawee, drawee);
        assertEq(b.payee, payee);
    }

    function test_Revert_Draw_ZeroAmount() public {
        vm.prank(drawer);
        vm.expectRevert(IBillOfExchange.ZeroAmount.selector);
        boe.draw(BILL, drawee, payee, address(usdc), 0, maturity, false);
    }

    function test_Revert_Draw_BillExists() public {
        _draw(false);
        vm.prank(drawer);
        vm.expectRevert(abi.encodeWithSelector(IBillOfExchange.BillExists.selector, BILL));
        boe.draw(BILL, drawee, payee, address(usdc), AMOUNT, maturity, false);
    }

    function test_Accept_Happy() public {
        _draw(false);
        vm.prank(drawee);
        boe.accept(BILL);
        assertEq(uint8(boe.billOf(BILL).state), uint8(IBillOfExchange.BillState.Accepted));
    }

    function test_Revert_Accept_NotDrawee() public {
        _draw(false);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IBillOfExchange.NotDrawee.selector, BILL));
        boe.accept(BILL);
    }

    function test_Endorse_TransfersPayeeRight() public {
        _draw(false);
        vm.prank(drawee);
        boe.accept(BILL);
        vm.prank(payee);
        boe.endorse(BILL, newHolder);

        IBillOfExchange.Bill memory b = boe.billOf(BILL);
        assertEq(b.payee, newHolder);
        assertEq(uint8(b.state), uint8(IBillOfExchange.BillState.Endorsed));
    }

    function test_Revert_Endorse_NotPayee() public {
        _draw(false);
        vm.prank(drawee);
        boe.accept(BILL);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IBillOfExchange.NotPayee.selector, BILL));
        boe.endorse(BILL, newHolder);
    }

    function test_Pay_AtMaturity_ToCurrentHolder() public {
        _draw(false);
        vm.prank(drawee);
        boe.accept(BILL);
        vm.prank(payee);
        boe.endorse(BILL, newHolder);

        vm.warp(block.timestamp + 31 days);
        boe.pay(BILL);

        assertEq(uint8(boe.billOf(BILL).state), uint8(IBillOfExchange.BillState.Paid));
        assertEq(usdc.balanceOf(newHolder), AMOUNT); // endorsed holder collected
        assertEq(usdc.balanceOf(payee), 0);
    }

    function test_Pay_Sight_Immediately() public {
        _draw(true);
        vm.prank(drawee);
        boe.accept(BILL);
        boe.pay(BILL); // no maturity wait for sight bills
        assertEq(usdc.balanceOf(payee), AMOUNT);
    }

    function test_Revert_Pay_NotMatured() public {
        _draw(false);
        vm.prank(drawee);
        boe.accept(BILL);
        vm.expectRevert(abi.encodeWithSelector(IBillOfExchange.NotMatured.selector, BILL, maturity));
        boe.pay(BILL);
    }

    function test_Revert_Pay_NotAccepted() public {
        _draw(true);
        vm.expectRevert(
            abi.encodeWithSelector(
                IBillOfExchange.InvalidState.selector,
                BILL,
                IBillOfExchange.BillState.Accepted,
                IBillOfExchange.BillState.Drawn
            )
        );
        boe.pay(BILL);
    }

    function test_Dishonour_Happy() public {
        _draw(false);
        vm.prank(drawee);
        boe.accept(BILL);
        vm.warp(block.timestamp + 31 days);
        vm.prank(payee);
        boe.dishonour(BILL, "no funds");
        assertEq(uint8(boe.billOf(BILL).state), uint8(IBillOfExchange.BillState.Dishonoured));
    }

    function test_Cancel_BeforeAcceptance() public {
        _draw(false);
        vm.prank(drawer);
        boe.cancel(BILL);
        assertEq(uint8(boe.billOf(BILL).state), uint8(IBillOfExchange.BillState.Cancelled));
    }

    function test_Revert_Cancel_NotDrawer() public {
        _draw(false);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IBillOfExchange.NotDrawer.selector, BILL));
        boe.cancel(BILL);
    }

    function test_Revert_UnknownBill() public {
        vm.prank(drawee);
        vm.expectRevert(abi.encodeWithSelector(IBillOfExchange.UnknownBill.selector, keccak256("nope")));
        boe.accept(keccak256("nope"));
    }
}
