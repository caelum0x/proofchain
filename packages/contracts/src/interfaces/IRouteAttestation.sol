// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IRouteAttestation
/// @notice Records a planned route for a shipment as an ordered sequence of geohash waypoints, then
///         attests actual passage of each waypoint from signed telematics. Deviations (out-of-corridor or
///         skipped waypoints) are flagged, producing a verifiable chain-of-custody route proof.
/// @dev deps (AddressBook): FleetRegistry, FreightBooking, IoTSensorRegistry.
interface IRouteAttestation {
    enum RouteState {
        None,
        Planned,
        InProgress,
        Completed,
        Deviated,
        Cancelled
    }

    struct Waypoint {
        bytes32 geohash;
        uint64 plannedEta;
        uint64 reachedAt;
        bool reached;
    }

    struct Route {
        bytes32 routeId;
        bytes32 bookingId;
        bytes32 assetId;
        uint16 waypointCount;
        uint16 reachedCount;
        uint16 deviationCount;
        RouteState state;
    }

    event RoutePlanned(bytes32 indexed routeId, bytes32 indexed bookingId, bytes32 indexed assetId, uint16 waypointCount);
    event WaypointReached(bytes32 indexed routeId, uint16 indexed index, bytes32 geohash, uint64 reachedAt);
    event Deviation(bytes32 indexed routeId, uint16 indexed index, bytes32 reportedGeohash);
    event RouteCompleted(bytes32 indexed routeId);
    event RouteCancelled(bytes32 indexed routeId);

    error RouteExists(bytes32 routeId);
    error UnknownRoute(bytes32 routeId);
    error InvalidState(bytes32 routeId, RouteState expected, RouteState actual);
    error EmptyRoute();
    error IndexOutOfRange(bytes32 routeId, uint16 index);
    error NotSequential(bytes32 routeId, uint16 index);

    /// @notice Plan a route with ordered waypoints and planned ETAs. REGISTRAR_ROLE or carrier.
    function planRoute(bytes32 routeId, bytes32 bookingId, bytes32 assetId, bytes32[] calldata geohashes, uint64[] calldata plannedEtas)
        external;

    /// @notice Attest passage of the next expected waypoint from a signed reading. KEEPER_ROLE only.
    function attestWaypoint(bytes32 routeId, uint16 index, bytes32 reportedGeohash) external;

    /// @notice Cancel a route.
    function cancel(bytes32 routeId) external;

    /// @notice True if all waypoints were reached in order with no deviations.
    function isOnRoute(bytes32 routeId) external view returns (bool);

    function routeOf(bytes32 routeId) external view returns (Route memory);
    function waypointAt(bytes32 routeId, uint16 index) external view returns (Waypoint memory);
}
