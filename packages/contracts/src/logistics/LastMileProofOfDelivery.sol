// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { ILastMileProofOfDelivery } from "../interfaces/ILastMileProofOfDelivery.sol";

/// @title LastMileProofOfDelivery
/// @notice Captures cryptographic last-mile proof of delivery. A courier is dispatched with a hash
///         commitment of a one-time code held by the recipient; delivery is confirmed by revealing
///         the code preimage, which — together with geolocation and a proof hash — produces a
///         verifiable PoD that can close the delivery leg (and gate downstream freight release).
/// @dev Deps resolved via the {AddressBook}. The OTP commitment is `keccak256(otp)`; the courier
///      submits the preimage the recipient provides. Failed attempts accumulate up to
///      {MAX_ATTEMPTS} before the leg is marked Failed. No funds move in this contract.
contract LastMileProofOfDelivery is ProofChainAccess, ILastMileProofOfDelivery {
    /// @notice Maximum failed delivery attempts before the leg is marked Failed.
    uint8 public constant MAX_ATTEMPTS = 3;

    mapping(bytes32 => Delivery) private _deliveries;

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc ILastMileProofOfDelivery
    function dispatch(bytes32 deliveryId, bytes32 bookingId, address courier, address recipient, bytes32 otpCommit)
        external
    {
        _requireNotGloballyPaused();
        if (courier == address(0) || recipient == address(0)) revert ZeroAddress();
        if (otpCommit == bytes32(0)) revert ZeroCommit();
        if (!hasRole(Roles.REGISTRAR_ROLE, msg.sender) && msg.sender != courier) revert NotCourier(deliveryId);
        if (_deliveries[deliveryId].state != DeliveryState.None) revert DeliveryExists(deliveryId);

        _deliveries[deliveryId] = Delivery({
            deliveryId: deliveryId,
            bookingId: bookingId,
            courier: courier,
            recipient: recipient,
            otpCommit: otpCommit,
            geohash: bytes32(0),
            proofHash: bytes32(0),
            dispatchedAt: uint64(block.timestamp),
            deliveredAt: 0,
            state: DeliveryState.Dispatched,
            attempts: 0
        });

        emit Dispatched(deliveryId, bookingId, courier, recipient);
    }

    /// @inheritdoc ILastMileProofOfDelivery
    function confirmDelivery(bytes32 deliveryId, bytes calldata otp, bytes32 geohash, bytes32 proofHash) external {
        _requireNotGloballyPaused();
        Delivery storage d = _delivery(deliveryId);
        if (msg.sender != d.courier) revert NotCourier(deliveryId);
        if (d.state != DeliveryState.Dispatched) {
            revert InvalidState(deliveryId, DeliveryState.Dispatched, d.state);
        }
        if (keccak256(otp) != d.otpCommit) revert BadOtp(deliveryId);

        d.state = DeliveryState.Delivered;
        d.geohash = geohash;
        d.proofHash = proofHash;
        d.deliveredAt = uint64(block.timestamp);

        emit Delivered(deliveryId, geohash, proofHash, d.deliveredAt);
    }

    /// @inheritdoc ILastMileProofOfDelivery
    function recordFailure(bytes32 deliveryId, bytes32 reason) external {
        _requireNotGloballyPaused();
        Delivery storage d = _delivery(deliveryId);
        if (msg.sender != d.courier) revert NotCourier(deliveryId);
        if (d.state != DeliveryState.Dispatched) {
            revert InvalidState(deliveryId, DeliveryState.Dispatched, d.state);
        }

        d.attempts += 1;
        if (d.attempts >= MAX_ATTEMPTS) {
            d.state = DeliveryState.Failed;
        }

        emit DeliveryFailed(deliveryId, d.attempts, reason);
    }

    /// @inheritdoc ILastMileProofOfDelivery
    function dispute(bytes32 deliveryId, bytes32 reason) external {
        _requireNotGloballyPaused();
        Delivery storage d = _delivery(deliveryId);
        if (msg.sender != d.courier && msg.sender != d.recipient) revert NotCourier(deliveryId);
        if (d.state == DeliveryState.None || d.state == DeliveryState.Disputed) {
            revert InvalidState(deliveryId, DeliveryState.Delivered, d.state);
        }

        d.state = DeliveryState.Disputed;
        emit Disputed(deliveryId, reason);
    }

    /// @inheritdoc ILastMileProofOfDelivery
    function isDelivered(bytes32 deliveryId) external view returns (bool) {
        return _deliveries[deliveryId].state == DeliveryState.Delivered;
    }

    /// @inheritdoc ILastMileProofOfDelivery
    function deliveryOf(bytes32 deliveryId) external view returns (Delivery memory) {
        return _deliveries[deliveryId];
    }

    // --------------------------------------------------------------------- internal

    function _delivery(bytes32 deliveryId) private view returns (Delivery storage d) {
        d = _deliveries[deliveryId];
        if (d.state == DeliveryState.None) revert UnknownDelivery(deliveryId);
    }
}
