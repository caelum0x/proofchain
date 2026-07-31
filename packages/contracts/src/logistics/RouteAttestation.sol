// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IRouteAttestation } from "../interfaces/IRouteAttestation.sol";
import { IFreightBooking } from "../interfaces/IFreightBooking.sol";

/// @title RouteAttestation
/// @notice Records a planned route for a shipment as an ordered sequence of geohash waypoints, then
///         attests actual passage of each waypoint in order from signed telematics readings. A
///         reported geohash that does not match the planned waypoint is flagged as a deviation,
///         producing a verifiable, tamper-evident chain-of-custody route proof.
/// @dev Deps resolved via the {AddressBook}. Planning is open to `REGISTRAR_ROLE` or the booking's
///      carrier (resolved via the optional {FreightBooking}); waypoint attestation is `KEEPER_ROLE`
///      only. Waypoints must be attested strictly in sequence.
contract RouteAttestation is ProofChainAccess, IRouteAttestation {
    mapping(bytes32 => Route) private _routes;
    mapping(bytes32 => Waypoint[]) private _waypoints;

    /// @notice Planned geohash / ETA arrays had mismatched lengths.
    error LengthMismatch();
    /// @notice The caller is neither a registrar nor the booking's carrier.
    error NotAuthorizedPlanner(bytes32 bookingId);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IRouteAttestation
    function planRoute(
        bytes32 routeId,
        bytes32 bookingId,
        bytes32 assetId,
        bytes32[] calldata geohashes,
        uint64[] calldata plannedEtas
    ) external {
        _requireNotGloballyPaused();
        if (_routes[routeId].state != RouteState.None) revert RouteExists(routeId);
        if (geohashes.length == 0) revert EmptyRoute();
        if (geohashes.length != plannedEtas.length) revert LengthMismatch();
        if (geohashes.length > type(uint16).max) revert EmptyRoute();
        _requirePlanner(bookingId);

        for (uint256 i = 0; i < geohashes.length; i++) {
            _waypoints[routeId].push(
                Waypoint({ geohash: geohashes[i], plannedEta: plannedEtas[i], reachedAt: 0, reached: false })
            );
        }

        _routes[routeId] = Route({
            routeId: routeId,
            bookingId: bookingId,
            assetId: assetId,
            waypointCount: uint16(geohashes.length),
            reachedCount: 0,
            deviationCount: 0,
            state: RouteState.Planned
        });

        emit RoutePlanned(routeId, bookingId, assetId, uint16(geohashes.length));
    }

    /// @inheritdoc IRouteAttestation
    function attestWaypoint(bytes32 routeId, uint16 index, bytes32 reportedGeohash)
        external
        onlyRole(Roles.KEEPER_ROLE)
    {
        _requireNotGloballyPaused();
        Route storage r = _route(routeId);
        if (r.state != RouteState.Planned && r.state != RouteState.InProgress && r.state != RouteState.Deviated) {
            revert InvalidState(routeId, RouteState.InProgress, r.state);
        }
        if (index >= r.waypointCount) revert IndexOutOfRange(routeId, index);
        // Strictly sequential: the next expected waypoint is `reachedCount`.
        if (index != r.reachedCount) revert NotSequential(routeId, index);

        Waypoint storage wp = _waypoints[routeId][index];
        wp.reached = true;
        wp.reachedAt = uint64(block.timestamp);
        r.reachedCount += 1;

        bool deviated = reportedGeohash != wp.geohash;
        if (deviated) {
            r.deviationCount += 1;
            if (r.state != RouteState.Deviated) r.state = RouteState.Deviated;
            emit Deviation(routeId, index, reportedGeohash);
        } else if (r.state == RouteState.Planned) {
            r.state = RouteState.InProgress;
        }

        emit WaypointReached(routeId, index, wp.geohash, wp.reachedAt);

        // Finalize once every waypoint is accounted for.
        if (r.reachedCount == r.waypointCount) {
            if (r.deviationCount == 0) {
                r.state = RouteState.Completed;
                emit RouteCompleted(routeId);
            } else {
                r.state = RouteState.Deviated;
            }
        }
    }

    /// @inheritdoc IRouteAttestation
    function cancel(bytes32 routeId) external {
        _requireNotGloballyPaused();
        Route storage r = _route(routeId);
        if (r.state == RouteState.Completed || r.state == RouteState.Cancelled) {
            revert InvalidState(routeId, RouteState.Planned, r.state);
        }
        _requirePlanner(r.bookingId);

        r.state = RouteState.Cancelled;
        emit RouteCancelled(routeId);
    }

    /// @inheritdoc IRouteAttestation
    function isOnRoute(bytes32 routeId) external view returns (bool) {
        Route storage r = _routes[routeId];
        return r.state == RouteState.Completed && r.deviationCount == 0
            && r.reachedCount == r.waypointCount && r.waypointCount > 0;
    }

    /// @inheritdoc IRouteAttestation
    function routeOf(bytes32 routeId) external view returns (Route memory) {
        return _routes[routeId];
    }

    /// @inheritdoc IRouteAttestation
    function waypointAt(bytes32 routeId, uint16 index) external view returns (Waypoint memory) {
        if (index >= _routes[routeId].waypointCount) revert IndexOutOfRange(routeId, index);
        return _waypoints[routeId][index];
    }

    // --------------------------------------------------------------------- internal

    function _route(bytes32 routeId) private view returns (Route storage r) {
        r = _routes[routeId];
        if (r.state == RouteState.None) revert UnknownRoute(routeId);
    }

    /// @dev Authorize planning/cancel: a registrar always passes; otherwise the caller must be the
    ///      carrier on the referenced {FreightBooking} (when that module is wired).
    function _requirePlanner(bytes32 bookingId) private view {
        if (hasRole(Roles.REGISTRAR_ROLE, msg.sender)) return;
        address fb = _addrOrZero(Keys.FREIGHT_BOOKING);
        if (fb != address(0)) {
            try IFreightBooking(fb).bookingOf(bookingId) returns (IFreightBooking.Booking memory b) {
                if (b.carrier == msg.sender) return;
            } catch { }
        }
        revert NotAuthorizedPlanner(bookingId);
    }
}
