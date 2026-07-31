// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IFreightBooking
/// @notice Freight booking lifecycle between a shipper and a carrier for a batch over an origin->destination
///         lane and mode (sea/air/road/rail). The shipper requests, the carrier confirms and quotes, the
///         shipper pays the freight into escrow, and status advances through pickup to delivery.
/// @dev deps (AddressBook): CarrierRegistry, StablecoinRegistry, SettlementEscrow, RouteAttestation.
interface IFreightBooking {
    enum Mode {
        Sea,
        Air,
        Road,
        Rail,
        Multimodal
    }

    enum BookingState {
        None,
        Requested,
        Confirmed,
        Paid,
        InTransit,
        Delivered,
        Cancelled
    }

    struct Booking {
        bytes32 bookingId;
        bytes32 batchId;
        address shipper;
        address carrier;
        Mode mode;
        bytes32 origin;
        bytes32 destination;
        address token;
        uint256 freightAmount;
        uint64 etd;
        uint64 eta;
        BookingState state;
    }

    event Requested(bytes32 indexed bookingId, bytes32 indexed batchId, address indexed shipper, address carrier, Mode mode);
    event Confirmed(bytes32 indexed bookingId, uint256 freightAmount, uint64 etd, uint64 eta);
    event Paid(bytes32 indexed bookingId, uint256 amount);
    event PickedUp(bytes32 indexed bookingId);
    event Delivered(bytes32 indexed bookingId);
    event Cancelled(bytes32 indexed bookingId);

    error BookingExists(bytes32 bookingId);
    error UnknownBooking(bytes32 bookingId);
    error InvalidState(bytes32 bookingId, BookingState expected, BookingState actual);
    error NotShipper(bytes32 bookingId);
    error NotCarrier(bytes32 bookingId);
    error ZeroAmount();

    /// @notice Shipper requests freight for a batch on a lane.
    function request(bytes32 bookingId, bytes32 batchId, address carrier, Mode mode, bytes32 origin, bytes32 destination, address token)
        external;

    /// @notice Carrier confirms the booking with a freight quote and schedule.
    function confirm(bytes32 bookingId, uint256 freightAmount, uint64 etd, uint64 eta) external;

    /// @notice Shipper pays freight into escrow.
    function payFreight(bytes32 bookingId) external;

    /// @notice Carrier marks the shipment picked up / in transit.
    function markPickedUp(bytes32 bookingId) external;

    /// @notice Carrier marks the shipment delivered, releasing freight from escrow.
    function markDelivered(bytes32 bookingId) external;

    /// @notice Cancel a booking before pickup.
    function cancel(bytes32 bookingId) external;

    function bookingOf(bytes32 bookingId) external view returns (Booking memory);
}
