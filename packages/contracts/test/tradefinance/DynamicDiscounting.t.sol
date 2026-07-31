// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { DynamicDiscounting } from "../../src/tradefinance/DynamicDiscounting.sol";
import { IDynamicDiscounting } from "../../src/interfaces/IDynamicDiscounting.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract DynamicDiscountingTest is Test {
    AddressBook internal book;
    DynamicDiscounting internal dd;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal buyer = address(0xB111);
    address internal supplier = address(0x5099);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant OFFER = keccak256("offer-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    uint256 internal constant FACE = 1_000e6;
    uint16 internal constant MAX_DISC = 400; // 4%
    uint64 internal dueDate;
    uint64 internal start;

    function setUp() public {
        vm.prank(admin);
        book = new AddressBook(admin);
        dd = new DynamicDiscounting(address(book), admin);
        usdc = new MockUSDC();

        usdc.mint(buyer, FACE * 10);
        vm.prank(buyer);
        usdc.approve(address(dd), type(uint256).max);

        start = uint64(block.timestamp);
        dueDate = uint64(block.timestamp + 100 days);
    }

    function _open() internal {
        vm.prank(buyer);
        dd.openOffer(OFFER, BATCH, supplier, address(usdc), FACE, MAX_DISC, dueDate);
    }

    function test_Open_EscrowsFace() public {
        _open();
        assertEq(usdc.balanceOf(address(dd)), FACE);
        assertEq(uint8(dd.offerOf(OFFER).state), uint8(IDynamicDiscounting.OfferState.Open));
    }

    function test_Revert_Open_PastDueDate() public {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(IDynamicDiscounting.PastDueDate.selector, uint64(block.timestamp)));
        dd.openOffer(OFFER, BATCH, supplier, address(usdc), FACE, MAX_DISC, uint64(block.timestamp));
    }

    function test_CurrentDiscount_DecaysLinearly() public {
        _open();
        // At start: full discount.
        assertEq(dd.currentDiscountBps(OFFER), MAX_DISC);
        // Halfway to due date: ~half discount.
        vm.warp(start + 50 days);
        assertEq(dd.currentDiscountBps(OFFER), MAX_DISC / 2);
    }

    function test_Accept_EarlyAtStart_PaysDiscounted() public {
        _open();
        // Accept immediately -> full max discount applied.
        uint256 discount = (FACE * MAX_DISC) / 10_000; // 40e6
        uint256 paid = FACE - discount; // 960e6

        vm.prank(supplier);
        dd.accept(OFFER);

        assertEq(uint8(dd.offerOf(OFFER).state), uint8(IDynamicDiscounting.OfferState.Accepted));
        assertEq(usdc.balanceOf(supplier), paid);
        assertEq(usdc.balanceOf(buyer), (FACE * 10) - FACE + discount); // discount refunded to buyer
        assertEq(usdc.balanceOf(address(dd)), 0);
    }

    function test_Revert_Accept_NotSupplier() public {
        _open();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IDynamicDiscounting.NotSupplier.selector, OFFER));
        dd.accept(OFFER);
    }

    function test_Revert_Accept_PastDue() public {
        _open();
        vm.warp(dueDate + 1);
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IDynamicDiscounting.PastDueDate.selector, dueDate));
        dd.accept(OFFER);
    }

    function test_Expire_ReturnsToBuyer() public {
        _open();
        vm.warp(dueDate + 1);
        dd.expire(OFFER);
        assertEq(uint8(dd.offerOf(OFFER).state), uint8(IDynamicDiscounting.OfferState.Expired));
        assertEq(usdc.balanceOf(buyer), FACE * 10);
        assertEq(usdc.balanceOf(address(dd)), 0);
    }

    function test_Cancel_ReturnsToBuyer() public {
        _open();
        vm.prank(buyer);
        dd.cancel(OFFER);
        assertEq(uint8(dd.offerOf(OFFER).state), uint8(IDynamicDiscounting.OfferState.Cancelled));
        assertEq(usdc.balanceOf(buyer), FACE * 10);
    }

    function test_Revert_Cancel_NotBuyer() public {
        _open();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IDynamicDiscounting.NotBuyer.selector, OFFER));
        dd.cancel(OFFER);
    }

    function test_Revert_OfferExists() public {
        _open();
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(IDynamicDiscounting.OfferExists.selector, OFFER));
        dd.openOffer(OFFER, BATCH, supplier, address(usdc), FACE, MAX_DISC, dueDate);
    }
}
