// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ILastMileProofOfDelivery
/// @notice Captures last-mile proof of delivery for a shipment: a courier is assigned, the recipient
///         confirms receipt via a one-time-code commitment (hash), and geolocation + timestamp are recorded.
///         A confirmed PoD can release freight/escrow and close the delivery leg.
/// @dev deps (AddressBook): FreightBooking, RouteAttestation, SettlementEscrow.
interface ILastMileProofOfDelivery {
    enum DeliveryState {
        None,
        Dispatched,
        Delivered,
        Failed,
        Disputed
    }

    struct Delivery {
        bytes32 deliveryId;
        bytes32 bookingId;
        address courier;
        address recipient;
        bytes32 otpCommit;
        bytes32 geohash;
        bytes32 proofHash;
        uint64 dispatchedAt;
        uint64 deliveredAt;
        DeliveryState state;
        uint8 attempts;
    }

    event Dispatched(bytes32 indexed deliveryId, bytes32 indexed bookingId, address indexed courier, address recipient);
    event Delivered(bytes32 indexed deliveryId, bytes32 geohash, bytes32 proofHash, uint64 deliveredAt);
    event DeliveryFailed(bytes32 indexed deliveryId, uint8 attempts, bytes32 reason);
    event Disputed(bytes32 indexed deliveryId, bytes32 reason);

    error DeliveryExists(bytes32 deliveryId);
    error UnknownDelivery(bytes32 deliveryId);
    error InvalidState(bytes32 deliveryId, DeliveryState expected, DeliveryState actual);
    error NotCourier(bytes32 deliveryId);
    error BadOtp(bytes32 deliveryId);
    error ZeroCommit();

    /// @notice Dispatch a delivery leg with an OTP commitment the recipient will reveal on receipt.
    function dispatch(bytes32 deliveryId, bytes32 bookingId, address courier, address recipient, bytes32 otpCommit)
        external;

    /// @notice Confirm delivery by revealing the OTP preimage; records geolocation and proof hash.
    function confirmDelivery(bytes32 deliveryId, bytes calldata otp, bytes32 geohash, bytes32 proofHash) external;

    /// @notice Record a failed delivery attempt (recipient absent, refused, etc.).
    function recordFailure(bytes32 deliveryId, bytes32 reason) external;

    /// @notice Raise a dispute over a delivery outcome.
    function dispute(bytes32 deliveryId, bytes32 reason) external;

    /// @notice True if the delivery reached the Delivered state.
    function isDelivered(bytes32 deliveryId) external view returns (bool);

    function deliveryOf(bytes32 deliveryId) external view returns (Delivery memory);
}
