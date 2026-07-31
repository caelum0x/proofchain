// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { RouteAttestation } from "../../src/logistics/RouteAttestation.sol";
import { FreightBooking } from "../../src/logistics/FreightBooking.sol";
import { IRouteAttestation } from "../../src/interfaces/IRouteAttestation.sol";
import { IFreightBooking } from "../../src/interfaces/IFreightBooking.sol";

contract RouteAttestationTest is Test {
    AddressBook internal book;
    RouteAttestation internal ra;

    address internal admin = address(0xA11CE);
    address internal registrar = address(0x9E9);
    address internal keeper = address(0xC0FFEE);
    address internal carrier = address(0xCA44);
    address internal shipper = address(0x5417);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant ROUTE = keccak256("route-1");
    bytes32 internal constant BOOKING = keccak256("booking-1");
    bytes32 internal constant ASSET = keccak256("asset-1");
    bytes32 internal constant WP0 = keccak256("geo-0");
    bytes32 internal constant WP1 = keccak256("geo-1");
    bytes32 internal constant WP2 = keccak256("geo-2");

    event RoutePlanned(bytes32 indexed routeId, bytes32 indexed bookingId, bytes32 indexed assetId, uint16 waypointCount);
    event WaypointReached(bytes32 indexed routeId, uint16 indexed index, bytes32 geohash, uint64 reachedAt);
    event Deviation(bytes32 indexed routeId, uint16 indexed index, bytes32 reportedGeohash);
    event RouteCompleted(bytes32 indexed routeId);
    event RouteCancelled(bytes32 indexed routeId);

    function setUp() public {
        book = new AddressBook(admin);
        ra = new RouteAttestation(address(book), admin);
        vm.startPrank(admin);
        ra.grantRole(Roles.REGISTRAR_ROLE, registrar);
        ra.grantRole(Roles.KEEPER_ROLE, keeper);
        vm.stopPrank();
    }

    function _geohashes() internal pure returns (bytes32[] memory g) {
        g = new bytes32[](3);
        g[0] = WP0;
        g[1] = WP1;
        g[2] = WP2;
    }

    function _etas() internal view returns (uint64[] memory e) {
        e = new uint64[](3);
        e[0] = uint64(block.timestamp + 1 days);
        e[1] = uint64(block.timestamp + 2 days);
        e[2] = uint64(block.timestamp + 3 days);
    }

    function _plan() internal {
        vm.prank(registrar);
        ra.planRoute(ROUTE, BOOKING, ASSET, _geohashes(), _etas());
    }

    // ---------------------------------------------------------------- plan

    function test_Plan_Happy() public {
        vm.expectEmit(true, true, true, true);
        emit RoutePlanned(ROUTE, BOOKING, ASSET, 3);
        _plan();

        IRouteAttestation.Route memory r = ra.routeOf(ROUTE);
        assertEq(uint8(r.state), uint8(IRouteAttestation.RouteState.Planned));
        assertEq(r.waypointCount, 3);
        assertEq(r.reachedCount, 0);
        assertEq(ra.waypointAt(ROUTE, 1).geohash, WP1);
    }

    function test_Plan_ByCarrierViaBooking() public {
        // Wire a real FreightBooking and create a booking so the carrier is an authorized planner.
        FreightBooking fb = new FreightBooking(address(book), admin);
        vm.prank(admin);
        book.setAddress(Keys.FREIGHT_BOOKING, address(fb));
        vm.prank(shipper);
        fb.request(BOOKING, keccak256("batch"), carrier, IFreightBooking.Mode.Road, bytes32("O"), bytes32("D"), address(0x1234));

        vm.prank(carrier);
        ra.planRoute(ROUTE, BOOKING, ASSET, _geohashes(), _etas());
        assertEq(uint8(ra.routeOf(ROUTE).state), uint8(IRouteAttestation.RouteState.Planned));
    }

    function test_Revert_Plan_NotAuthorized() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(RouteAttestation.NotAuthorizedPlanner.selector, BOOKING));
        ra.planRoute(ROUTE, BOOKING, ASSET, _geohashes(), _etas());
    }

    function test_Revert_Plan_Empty() public {
        bytes32[] memory g = new bytes32[](0);
        uint64[] memory e = new uint64[](0);
        vm.prank(registrar);
        vm.expectRevert(IRouteAttestation.EmptyRoute.selector);
        ra.planRoute(ROUTE, BOOKING, ASSET, g, e);
    }

    function test_Revert_Plan_LengthMismatch() public {
        bytes32[] memory g = new bytes32[](2);
        uint64[] memory e = new uint64[](3);
        vm.prank(registrar);
        vm.expectRevert(RouteAttestation.LengthMismatch.selector);
        ra.planRoute(ROUTE, BOOKING, ASSET, g, e);
    }

    function test_Revert_Plan_Exists() public {
        _plan();
        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(IRouteAttestation.RouteExists.selector, ROUTE));
        ra.planRoute(ROUTE, BOOKING, ASSET, _geohashes(), _etas());
    }

    // ---------------------------------------------------------------- attest

    function test_Attest_AllInOrder_Completes() public {
        _plan();
        vm.startPrank(keeper);
        ra.attestWaypoint(ROUTE, 0, WP0);
        assertEq(uint8(ra.routeOf(ROUTE).state), uint8(IRouteAttestation.RouteState.InProgress));
        ra.attestWaypoint(ROUTE, 1, WP1);

        vm.expectEmit(true, false, false, false);
        emit RouteCompleted(ROUTE);
        ra.attestWaypoint(ROUTE, 2, WP2);
        vm.stopPrank();

        IRouteAttestation.Route memory r = ra.routeOf(ROUTE);
        assertEq(uint8(r.state), uint8(IRouteAttestation.RouteState.Completed));
        assertEq(r.reachedCount, 3);
        assertEq(r.deviationCount, 0);
        assertTrue(ra.isOnRoute(ROUTE));
        assertTrue(ra.waypointAt(ROUTE, 2).reached);
    }

    function test_Attest_Deviation_FlagsAndNotOnRoute() public {
        _plan();
        vm.startPrank(keeper);
        ra.attestWaypoint(ROUTE, 0, WP0);

        vm.expectEmit(true, true, false, true);
        emit Deviation(ROUTE, 1, keccak256("wrong"));
        ra.attestWaypoint(ROUTE, 1, keccak256("wrong"));
        assertEq(uint8(ra.routeOf(ROUTE).state), uint8(IRouteAttestation.RouteState.Deviated));

        ra.attestWaypoint(ROUTE, 2, WP2);
        vm.stopPrank();

        IRouteAttestation.Route memory r = ra.routeOf(ROUTE);
        assertEq(r.deviationCount, 1);
        assertEq(r.reachedCount, 3);
        assertEq(uint8(r.state), uint8(IRouteAttestation.RouteState.Deviated));
        assertFalse(ra.isOnRoute(ROUTE));
    }

    function test_Revert_Attest_NotKeeper() public {
        _plan();
        vm.prank(stranger);
        vm.expectRevert();
        ra.attestWaypoint(ROUTE, 0, WP0);
    }

    function test_Revert_Attest_NotSequential() public {
        _plan();
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IRouteAttestation.NotSequential.selector, ROUTE, uint16(1)));
        ra.attestWaypoint(ROUTE, 1, WP1);
    }

    function test_Revert_Attest_IndexOutOfRange() public {
        _plan();
        vm.startPrank(keeper);
        ra.attestWaypoint(ROUTE, 0, WP0);
        ra.attestWaypoint(ROUTE, 1, WP1);
        ra.attestWaypoint(ROUTE, 2, WP2);
        // route completed; further attest reverts on state
        vm.expectRevert(
            abi.encodeWithSelector(
                IRouteAttestation.InvalidState.selector, ROUTE, IRouteAttestation.RouteState.InProgress, IRouteAttestation.RouteState.Completed
            )
        );
        ra.attestWaypoint(ROUTE, 3, WP2);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- cancel

    function test_Cancel_Happy() public {
        _plan();
        vm.expectEmit(true, false, false, false);
        emit RouteCancelled(ROUTE);
        vm.prank(registrar);
        ra.cancel(ROUTE);
        assertEq(uint8(ra.routeOf(ROUTE).state), uint8(IRouteAttestation.RouteState.Cancelled));
    }

    function test_Revert_Cancel_Completed() public {
        _plan();
        vm.startPrank(keeper);
        ra.attestWaypoint(ROUTE, 0, WP0);
        ra.attestWaypoint(ROUTE, 1, WP1);
        ra.attestWaypoint(ROUTE, 2, WP2);
        vm.stopPrank();

        vm.prank(registrar);
        vm.expectRevert(
            abi.encodeWithSelector(
                IRouteAttestation.InvalidState.selector, ROUTE, IRouteAttestation.RouteState.Planned, IRouteAttestation.RouteState.Completed
            )
        );
        ra.cancel(ROUTE);
    }

    function test_Revert_UnknownRoute() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IRouteAttestation.UnknownRoute.selector, ROUTE));
        ra.attestWaypoint(ROUTE, 0, WP0);
    }
}
