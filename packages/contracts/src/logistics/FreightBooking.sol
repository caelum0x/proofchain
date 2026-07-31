// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IFreightBooking } from "../interfaces/IFreightBooking.sol";
import { ICarrierRegistry } from "../interfaces/ICarrierRegistry.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title FreightBooking
/// @notice Freight booking lifecycle between a shipper and a carrier for a provenance batch. The
///         shipper requests carriage on a lane, the carrier confirms with a freight quote and
///         schedule, the shipper escrows the freight in THIS contract, and the carrier advances the
///         shipment through pickup to delivery — at which point the escrowed freight is released to
///         the carrier. Bookings can be cancelled before pickup with a full refund of any escrow.
/// @dev Peers are resolved via the {AddressBook}. The freight is self-custodied here (a scoped
///      escrow) rather than routed through {SettlementEscrow}, whose deals are bound to a batch's
///      provenance supplier — the freight payee is the carrier, a different counterparty. All fund
///      movement uses {SafeERC20}; every fund-moving external is `nonReentrant`. The
///      {CarrierRegistry} and {StablecoinRegistry} are OPTIONAL: when wired they are enforced, when
///      unwired the module degrades gracefully.
contract FreightBooking is ProofChainAccess, ReentrancyGuard, IFreightBooking {
    using SafeERC20 for IERC20;

    mapping(bytes32 => Booking) private _bookings;
    /// @dev Amount ACTUALLY escrowed per booking (fee-on-transfer safe), released on delivery.
    mapping(bytes32 => uint256) private _escrowed;

    /// @notice The carrier is not registered in the wired {CarrierRegistry}.
    error CarrierNotRegistered(address carrier);
    /// @notice The settlement token is not on the wired {StablecoinRegistry} allowlist.
    error TokenNotAccepted(address token);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IFreightBooking
    function request(
        bytes32 bookingId,
        bytes32 batchId,
        address carrier,
        Mode mode,
        bytes32 origin,
        bytes32 destination,
        address token
    ) external {
        _requireNotGloballyPaused();
        if (carrier == address(0) || token == address(0)) revert ZeroAddress();
        if (_bookings[bookingId].state != BookingState.None) revert BookingExists(bookingId);
        _requireRegisteredCarrier(carrier);
        _requireAcceptedToken(token);

        _bookings[bookingId] = Booking({
            bookingId: bookingId,
            batchId: batchId,
            shipper: msg.sender,
            carrier: carrier,
            mode: mode,
            origin: origin,
            destination: destination,
            token: token,
            freightAmount: 0,
            etd: 0,
            eta: 0,
            state: BookingState.Requested
        });

        emit Requested(bookingId, batchId, msg.sender, carrier, mode);
    }

    /// @inheritdoc IFreightBooking
    function confirm(bytes32 bookingId, uint256 freightAmount, uint64 etd, uint64 eta) external {
        _requireNotGloballyPaused();
        Booking storage b = _get(bookingId);
        if (msg.sender != b.carrier) revert NotCarrier(bookingId);
        if (b.state != BookingState.Requested) {
            revert InvalidState(bookingId, BookingState.Requested, b.state);
        }
        if (freightAmount == 0) revert ZeroAmount();

        b.freightAmount = freightAmount;
        b.etd = etd;
        b.eta = eta;
        b.state = BookingState.Confirmed;

        emit Confirmed(bookingId, freightAmount, etd, eta);
    }

    /// @inheritdoc IFreightBooking
    function payFreight(bytes32 bookingId) external nonReentrant {
        _requireNotGloballyPaused();
        Booking storage b = _get(bookingId);
        if (msg.sender != b.shipper) revert NotShipper(bookingId);
        if (b.state != BookingState.Confirmed) {
            revert InvalidState(bookingId, BookingState.Confirmed, b.state);
        }

        IERC20 token = IERC20(b.token);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), b.freightAmount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        _escrowed[bookingId] = received;
        b.state = BookingState.Paid;

        emit Paid(bookingId, received);
    }

    /// @inheritdoc IFreightBooking
    function markPickedUp(bytes32 bookingId) external {
        _requireNotGloballyPaused();
        Booking storage b = _get(bookingId);
        if (msg.sender != b.carrier) revert NotCarrier(bookingId);
        if (b.state != BookingState.Paid) revert InvalidState(bookingId, BookingState.Paid, b.state);

        b.state = BookingState.InTransit;
        emit PickedUp(bookingId);
    }

    /// @inheritdoc IFreightBooking
    function markDelivered(bytes32 bookingId) external nonReentrant {
        _requireNotGloballyPaused();
        Booking storage b = _get(bookingId);
        if (msg.sender != b.carrier) revert NotCarrier(bookingId);
        if (b.state != BookingState.InTransit) {
            revert InvalidState(bookingId, BookingState.InTransit, b.state);
        }

        b.state = BookingState.Delivered;
        uint256 amount = _escrowed[bookingId];
        _escrowed[bookingId] = 0;
        if (amount > 0) IERC20(b.token).safeTransfer(b.carrier, amount);

        emit Delivered(bookingId);
    }

    /// @inheritdoc IFreightBooking
    function cancel(bytes32 bookingId) external nonReentrant {
        _requireNotGloballyPaused();
        Booking storage b = _get(bookingId);
        if (msg.sender != b.shipper && msg.sender != b.carrier) revert NotShipper(bookingId);
        // Cancellable only before pickup (Requested / Confirmed / Paid).
        if (
            b.state != BookingState.Requested && b.state != BookingState.Confirmed
                && b.state != BookingState.Paid
        ) {
            revert InvalidState(bookingId, BookingState.Confirmed, b.state);
        }

        BookingState prior = b.state;
        b.state = BookingState.Cancelled;

        // Refund any escrowed freight to the shipper.
        if (prior == BookingState.Paid) {
            uint256 amount = _escrowed[bookingId];
            _escrowed[bookingId] = 0;
            if (amount > 0) IERC20(b.token).safeTransfer(b.shipper, amount);
        }

        emit Cancelled(bookingId);
    }

    /// @inheritdoc IFreightBooking
    function bookingOf(bytes32 bookingId) external view returns (Booking memory) {
        return _bookings[bookingId];
    }

    /// @notice Freight amount currently held in escrow for a booking.
    function escrowedOf(bytes32 bookingId) external view returns (uint256) {
        return _escrowed[bookingId];
    }

    // --------------------------------------------------------------------- internal

    function _get(bytes32 bookingId) private view returns (Booking storage b) {
        b = _bookings[bookingId];
        if (b.state == BookingState.None) revert UnknownBooking(bookingId);
    }

    /// @dev Enforce carrier registration when a {CarrierRegistry} is wired; skip otherwise.
    function _requireRegisteredCarrier(address carrier) private view {
        address reg = _addrOrZero(Keys.CARRIER_REGISTRY);
        if (reg != address(0) && !ICarrierRegistry(reg).isCarrier(carrier)) {
            revert CarrierNotRegistered(carrier);
        }
    }

    /// @dev Enforce the token allowlist when a {StablecoinRegistry} is wired; skip otherwise.
    function _requireAcceptedToken(address token) private view {
        address reg = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (reg != address(0) && !IStablecoinRegistry(reg).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
