// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { LastMileProofOfDelivery } from "../../src/logistics/LastMileProofOfDelivery.sol";
import { ILastMileProofOfDelivery } from "../../src/interfaces/ILastMileProofOfDelivery.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

contract LastMileProofOfDeliveryTest is Test {
    AddressBook internal book;
    LastMileProofOfDelivery internal pod;

    address internal admin = address(0xA11CE);
    address internal courier = address(0xC0);
    address internal recipient = address(0x1EC1);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant DELIV = keccak256("deliv-1");
    bytes32 internal constant BOOKING = keccak256("booking-1");
    bytes32 internal constant GEO = keccak256("geo-final");
    bytes32 internal constant PROOF = keccak256("photo-hash");
    bytes internal OTP = bytes("123456");

    event Dispatched(bytes32 indexed deliveryId, bytes32 indexed bookingId, address indexed courier, address recipient);
    event Delivered(bytes32 indexed deliveryId, bytes32 geohash, bytes32 proofHash, uint64 deliveredAt);
    event DeliveryFailed(bytes32 indexed deliveryId, uint8 attempts, bytes32 reason);
    event Disputed(bytes32 indexed deliveryId, bytes32 reason);

    function _commit() internal view returns (bytes32) {
        return keccak256(OTP);
    }

    function setUp() public {
        book = new AddressBook(admin);
        pod = new LastMileProofOfDelivery(address(book), admin);
    }

    function _dispatch() internal {
        vm.prank(courier);
        pod.dispatch(DELIV, BOOKING, courier, recipient, _commit());
    }

    // ---------------------------------------------------------------- dispatch

    function test_Dispatch_Happy() public {
        vm.expectEmit(true, true, true, true);
        emit Dispatched(DELIV, BOOKING, courier, recipient);
        _dispatch();

        ILastMileProofOfDelivery.Delivery memory d = pod.deliveryOf(DELIV);
        assertEq(uint8(d.state), uint8(ILastMileProofOfDelivery.DeliveryState.Dispatched));
        assertEq(d.courier, courier);
        assertEq(d.recipient, recipient);
        assertEq(d.otpCommit, _commit());
    }

    function test_Dispatch_ByRegistrar() public {
        vm.prank(admin);
        pod.grantRole(Roles.REGISTRAR_ROLE, stranger);
        vm.prank(stranger);
        pod.dispatch(DELIV, BOOKING, courier, recipient, _commit());
        assertTrue(pod.deliveryOf(DELIV).state == ILastMileProofOfDelivery.DeliveryState.Dispatched);
    }

    function test_Revert_Dispatch_NotCourier() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ILastMileProofOfDelivery.NotCourier.selector, DELIV));
        pod.dispatch(DELIV, BOOKING, courier, recipient, _commit());
    }

    function test_Revert_Dispatch_ZeroCommit() public {
        vm.prank(courier);
        vm.expectRevert(ILastMileProofOfDelivery.ZeroCommit.selector);
        pod.dispatch(DELIV, BOOKING, courier, recipient, bytes32(0));
    }

    function test_Revert_Dispatch_ZeroRecipient() public {
        vm.prank(courier);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        pod.dispatch(DELIV, BOOKING, courier, address(0), _commit());
    }

    function test_Revert_Dispatch_Exists() public {
        _dispatch();
        vm.prank(courier);
        vm.expectRevert(abi.encodeWithSelector(ILastMileProofOfDelivery.DeliveryExists.selector, DELIV));
        pod.dispatch(DELIV, BOOKING, courier, recipient, _commit());
    }

    // ---------------------------------------------------------------- confirm

    function test_ConfirmDelivery_Happy() public {
        _dispatch();
        vm.expectEmit(true, false, false, true);
        emit Delivered(DELIV, GEO, PROOF, uint64(block.timestamp));
        vm.prank(courier);
        pod.confirmDelivery(DELIV, OTP, GEO, PROOF);

        ILastMileProofOfDelivery.Delivery memory d = pod.deliveryOf(DELIV);
        assertEq(uint8(d.state), uint8(ILastMileProofOfDelivery.DeliveryState.Delivered));
        assertEq(d.geohash, GEO);
        assertEq(d.proofHash, PROOF);
        assertTrue(pod.isDelivered(DELIV));
    }

    function test_Revert_Confirm_BadOtp() public {
        _dispatch();
        vm.prank(courier);
        vm.expectRevert(abi.encodeWithSelector(ILastMileProofOfDelivery.BadOtp.selector, DELIV));
        pod.confirmDelivery(DELIV, bytes("wrong"), GEO, PROOF);
    }

    function test_Revert_Confirm_NotCourier() public {
        _dispatch();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ILastMileProofOfDelivery.NotCourier.selector, DELIV));
        pod.confirmDelivery(DELIV, OTP, GEO, PROOF);
    }

    function test_Revert_Confirm_WrongState() public {
        _dispatch();
        vm.prank(courier);
        pod.confirmDelivery(DELIV, OTP, GEO, PROOF);
        vm.prank(courier);
        vm.expectRevert(
            abi.encodeWithSelector(
                ILastMileProofOfDelivery.InvalidState.selector, DELIV, ILastMileProofOfDelivery.DeliveryState.Dispatched, ILastMileProofOfDelivery.DeliveryState.Delivered
            )
        );
        pod.confirmDelivery(DELIV, OTP, GEO, PROOF);
    }

    // ---------------------------------------------------------------- failure

    function test_RecordFailure_MarksFailedAtMaxAttempts() public {
        _dispatch();
        vm.startPrank(courier);
        pod.recordFailure(DELIV, bytes32("absent"));
        assertEq(uint8(pod.deliveryOf(DELIV).state), uint8(ILastMileProofOfDelivery.DeliveryState.Dispatched));
        assertEq(pod.deliveryOf(DELIV).attempts, 1);

        pod.recordFailure(DELIV, bytes32("absent"));
        vm.expectEmit(true, false, false, true);
        emit DeliveryFailed(DELIV, 3, bytes32("refused"));
        pod.recordFailure(DELIV, bytes32("refused"));
        vm.stopPrank();

        ILastMileProofOfDelivery.Delivery memory d = pod.deliveryOf(DELIV);
        assertEq(d.attempts, 3);
        assertEq(uint8(d.state), uint8(ILastMileProofOfDelivery.DeliveryState.Failed));
    }

    function test_Revert_RecordFailure_NotCourier() public {
        _dispatch();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ILastMileProofOfDelivery.NotCourier.selector, DELIV));
        pod.recordFailure(DELIV, bytes32("x"));
    }

    // ---------------------------------------------------------------- dispute

    function test_Dispute_ByRecipient() public {
        _dispatch();
        vm.prank(courier);
        pod.confirmDelivery(DELIV, OTP, GEO, PROOF);

        vm.expectEmit(true, false, false, true);
        emit Disputed(DELIV, bytes32("never-arrived"));
        vm.prank(recipient);
        pod.dispute(DELIV, bytes32("never-arrived"));
        assertEq(uint8(pod.deliveryOf(DELIV).state), uint8(ILastMileProofOfDelivery.DeliveryState.Disputed));
        assertFalse(pod.isDelivered(DELIV));
    }

    function test_Revert_Dispute_NotParty() public {
        _dispatch();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ILastMileProofOfDelivery.NotCourier.selector, DELIV));
        pod.dispute(DELIV, bytes32("x"));
    }

    function test_Revert_UnknownDelivery() public {
        vm.prank(courier);
        vm.expectRevert(abi.encodeWithSelector(ILastMileProofOfDelivery.UnknownDelivery.selector, DELIV));
        pod.confirmDelivery(DELIV, OTP, GEO, PROOF);
    }
}
