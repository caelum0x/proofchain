// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Pauser } from "../../src/core/Pauser.sol";
import { Keys } from "../../src/core/Keys.sol";
import { FreightBooking } from "../../src/logistics/FreightBooking.sol";
import { IFreightBooking } from "../../src/interfaces/IFreightBooking.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract FreightBookingTest is Test {
    AddressBook internal book;
    FreightBooking internal fb;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal shipper = address(0x5417);
    address internal carrier = address(0xCA44);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BOOKING = keccak256("booking-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("SGSIN");
    bytes32 internal constant DEST = keccak256("NLRTM");
    uint256 internal constant FREIGHT = 500e6;

    event Requested(
        bytes32 indexed bookingId, bytes32 indexed batchId, address indexed shipper, address carrier, IFreightBooking.Mode mode
    );
    event Confirmed(bytes32 indexed bookingId, uint256 freightAmount, uint64 etd, uint64 eta);
    event Paid(bytes32 indexed bookingId, uint256 amount);
    event PickedUp(bytes32 indexed bookingId);
    event Delivered(bytes32 indexed bookingId);
    event Cancelled(bytes32 indexed bookingId);

    function setUp() public {
        book = new AddressBook(admin);
        fb = new FreightBooking(address(book), admin);
        usdc = new MockUSDC();

        usdc.mint(shipper, 10_000e6);
        vm.prank(shipper);
        usdc.approve(address(fb), type(uint256).max);
    }

    function _request() internal {
        vm.prank(shipper);
        fb.request(BOOKING, BATCH, carrier, IFreightBooking.Mode.Sea, ORIGIN, DEST, address(usdc));
    }

    function _confirm() internal {
        vm.prank(carrier);
        fb.confirm(BOOKING, FREIGHT, uint64(block.timestamp + 1 days), uint64(block.timestamp + 30 days));
    }

    function _pay() internal {
        vm.prank(shipper);
        fb.payFreight(BOOKING);
    }

    // ---------------------------------------------------------------- request

    function test_Request_Happy() public {
        vm.expectEmit(true, true, true, true);
        emit Requested(BOOKING, BATCH, shipper, carrier, IFreightBooking.Mode.Sea);
        _request();

        IFreightBooking.Booking memory b = fb.bookingOf(BOOKING);
        assertEq(uint8(b.state), uint8(IFreightBooking.BookingState.Requested));
        assertEq(b.shipper, shipper);
        assertEq(b.carrier, carrier);
        assertEq(b.token, address(usdc));
        assertEq(b.freightAmount, 0);
    }

    function test_Revert_Request_ZeroCarrier() public {
        vm.prank(shipper);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        fb.request(BOOKING, BATCH, address(0), IFreightBooking.Mode.Sea, ORIGIN, DEST, address(usdc));
    }

    function test_Revert_Request_ZeroToken() public {
        vm.prank(shipper);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        fb.request(BOOKING, BATCH, carrier, IFreightBooking.Mode.Sea, ORIGIN, DEST, address(0));
    }

    function test_Revert_Request_Exists() public {
        _request();
        vm.prank(shipper);
        vm.expectRevert(abi.encodeWithSelector(IFreightBooking.BookingExists.selector, BOOKING));
        fb.request(BOOKING, BATCH, carrier, IFreightBooking.Mode.Sea, ORIGIN, DEST, address(usdc));
    }

    // ---------------------------------------------------------------- confirm

    function test_Confirm_Happy() public {
        _request();
        vm.expectEmit(true, false, false, true);
        emit Confirmed(BOOKING, FREIGHT, uint64(block.timestamp + 1 days), uint64(block.timestamp + 30 days));
        _confirm();

        IFreightBooking.Booking memory b = fb.bookingOf(BOOKING);
        assertEq(uint8(b.state), uint8(IFreightBooking.BookingState.Confirmed));
        assertEq(b.freightAmount, FREIGHT);
    }

    function test_Revert_Confirm_NotCarrier() public {
        _request();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IFreightBooking.NotCarrier.selector, BOOKING));
        fb.confirm(BOOKING, FREIGHT, 0, 0);
    }

    function test_Revert_Confirm_ZeroAmount() public {
        _request();
        vm.prank(carrier);
        vm.expectRevert(IFreightBooking.ZeroAmount.selector);
        fb.confirm(BOOKING, 0, 0, 0);
    }

    function test_Revert_Confirm_WrongState() public {
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(IFreightBooking.UnknownBooking.selector, BOOKING));
        fb.confirm(BOOKING, FREIGHT, 0, 0);
    }

    // ---------------------------------------------------------------- pay

    function test_PayFreight_EscrowsFunds() public {
        _request();
        _confirm();

        uint256 shipperBefore = usdc.balanceOf(shipper);
        vm.expectEmit(true, false, false, true);
        emit Paid(BOOKING, FREIGHT);
        _pay();

        assertEq(usdc.balanceOf(shipper), shipperBefore - FREIGHT);
        assertEq(usdc.balanceOf(address(fb)), FREIGHT);
        assertEq(fb.escrowedOf(BOOKING), FREIGHT);
        assertEq(uint8(fb.bookingOf(BOOKING).state), uint8(IFreightBooking.BookingState.Paid));
    }

    function test_Revert_Pay_NotShipper() public {
        _request();
        _confirm();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IFreightBooking.NotShipper.selector, BOOKING));
        fb.payFreight(BOOKING);
    }

    function test_Revert_Pay_WrongState() public {
        _request();
        vm.prank(shipper);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFreightBooking.InvalidState.selector,
                BOOKING,
                IFreightBooking.BookingState.Confirmed,
                IFreightBooking.BookingState.Requested
            )
        );
        fb.payFreight(BOOKING);
    }

    // ---------------------------------------------------------------- delivery

    function test_FullDelivery_ReleasesFreightToCarrier() public {
        _request();
        _confirm();
        _pay();

        vm.expectEmit(true, false, false, false);
        emit PickedUp(BOOKING);
        vm.prank(carrier);
        fb.markPickedUp(BOOKING);
        assertEq(uint8(fb.bookingOf(BOOKING).state), uint8(IFreightBooking.BookingState.InTransit));

        uint256 carrierBefore = usdc.balanceOf(carrier);
        vm.expectEmit(true, false, false, false);
        emit Delivered(BOOKING);
        vm.prank(carrier);
        fb.markDelivered(BOOKING);

        assertEq(usdc.balanceOf(carrier), carrierBefore + FREIGHT);
        assertEq(usdc.balanceOf(address(fb)), 0);
        assertEq(fb.escrowedOf(BOOKING), 0);
        assertEq(uint8(fb.bookingOf(BOOKING).state), uint8(IFreightBooking.BookingState.Delivered));
    }

    function test_Revert_MarkPickedUp_NotCarrier() public {
        _request();
        _confirm();
        _pay();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IFreightBooking.NotCarrier.selector, BOOKING));
        fb.markPickedUp(BOOKING);
    }

    function test_Revert_MarkDelivered_WrongState() public {
        _request();
        _confirm();
        _pay();
        vm.prank(carrier);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFreightBooking.InvalidState.selector,
                BOOKING,
                IFreightBooking.BookingState.InTransit,
                IFreightBooking.BookingState.Paid
            )
        );
        fb.markDelivered(BOOKING);
    }

    // ---------------------------------------------------------------- cancel

    function test_Cancel_BeforePay_NoRefund() public {
        _request();
        _confirm();
        vm.expectEmit(true, false, false, false);
        emit Cancelled(BOOKING);
        vm.prank(shipper);
        fb.cancel(BOOKING);
        assertEq(uint8(fb.bookingOf(BOOKING).state), uint8(IFreightBooking.BookingState.Cancelled));
    }

    function test_Cancel_AfterPay_RefundsShipper() public {
        _request();
        _confirm();
        _pay();

        uint256 shipperBefore = usdc.balanceOf(shipper);
        vm.prank(carrier);
        fb.cancel(BOOKING);

        assertEq(usdc.balanceOf(shipper), shipperBefore + FREIGHT);
        assertEq(usdc.balanceOf(address(fb)), 0);
        assertEq(fb.escrowedOf(BOOKING), 0);
        assertEq(uint8(fb.bookingOf(BOOKING).state), uint8(IFreightBooking.BookingState.Cancelled));
    }

    function test_Revert_Cancel_NotParty() public {
        _request();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IFreightBooking.NotShipper.selector, BOOKING));
        fb.cancel(BOOKING);
    }

    function test_Revert_Cancel_AfterPickup() public {
        _request();
        _confirm();
        _pay();
        vm.prank(carrier);
        fb.markPickedUp(BOOKING);

        vm.prank(shipper);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFreightBooking.InvalidState.selector,
                BOOKING,
                IFreightBooking.BookingState.Confirmed,
                IFreightBooking.BookingState.InTransit
            )
        );
        fb.cancel(BOOKING);
    }

    // ---------------------------------------------------------------- pause

    function test_GlobalPause_BlocksRequest() public {
        Pauser pauser = new Pauser(admin);
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.prank(shipper);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        fb.request(BOOKING, BATCH, carrier, IFreightBooking.Mode.Sea, ORIGIN, DEST, address(usdc));
    }
}
