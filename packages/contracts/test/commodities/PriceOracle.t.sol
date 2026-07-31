// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { PriceOracle } from "../../src/commodities/PriceOracle.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IPriceOracle } from "../../src/interfaces/IPriceOracle.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract PriceOracleTest is Test {
    AddressBook internal book;
    PriceOracle internal oracle;

    address internal admin = address(0xA11CE);
    address internal keeper = address(0x11EE);
    address internal poolMgr = address(0x9007);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant SYMBOL = keccak256("COFFEE");
    uint32 internal constant HEARTBEAT = 3600;
    uint8 internal constant DECIMALS = 8;

    event FeedRegistered(bytes32 indexed symbol, uint8 decimals, uint32 heartbeat);
    event PriceUpdated(bytes32 indexed symbol, uint256 price, uint64 updatedAt);
    event FeedDeactivated(bytes32 indexed symbol);

    function setUp() public {
        book = new AddressBook(admin);
        oracle = new PriceOracle(address(book), admin);
        vm.startPrank(admin);
        oracle.grantRole(Roles.KEEPER_ROLE, keeper);
        oracle.grantRole(Roles.POOL_MANAGER_ROLE, poolMgr);
        vm.stopPrank();
        vm.warp(1_000_000);
    }

    function _register() internal {
        vm.prank(keeper);
        oracle.registerFeed(SYMBOL, DECIMALS, HEARTBEAT);
    }

    function test_RegisterFeed_ByKeeper() public {
        vm.expectEmit(true, false, false, true, address(oracle));
        emit FeedRegistered(SYMBOL, DECIMALS, HEARTBEAT);
        _register();

        IPriceOracle.Feed memory f = oracle.feedOf(SYMBOL);
        assertEq(f.decimals, DECIMALS);
        assertEq(f.heartbeat, HEARTBEAT);
        assertTrue(f.active);
    }

    function test_RegisterFeed_ByPoolManager() public {
        vm.prank(poolMgr);
        oracle.registerFeed(SYMBOL, DECIMALS, HEARTBEAT);
        assertTrue(oracle.feedOf(SYMBOL).active);
    }

    function test_RevertWhen_RegisterUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.KEEPER_ROLE)
        );
        oracle.registerFeed(SYMBOL, DECIMALS, HEARTBEAT);
    }

    function test_RevertWhen_RegisterZeroHeartbeat() public {
        vm.prank(keeper);
        vm.expectRevert(IPriceOracle.ZeroHeartbeat.selector);
        oracle.registerFeed(SYMBOL, DECIMALS, 0);
    }

    function test_RevertWhen_RegisterDuplicate() public {
        _register();
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IPriceOracle.FeedExists.selector, SYMBOL));
        oracle.registerFeed(SYMBOL, DECIMALS, HEARTBEAT);
    }

    function test_PushPrice_And_LatestPrice() public {
        _register();
        vm.expectEmit(true, false, false, true, address(oracle));
        emit PriceUpdated(SYMBOL, 1234e8, uint64(block.timestamp));
        vm.prank(keeper);
        oracle.pushPrice(SYMBOL, 1234e8);

        (uint256 price, uint64 updatedAt) = oracle.latestPrice(SYMBOL);
        assertEq(price, 1234e8);
        assertEq(updatedAt, uint64(block.timestamp));
    }

    function test_RevertWhen_PushByNonKeeper() public {
        _register();
        vm.prank(poolMgr);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, poolMgr, Roles.KEEPER_ROLE)
        );
        oracle.pushPrice(SYMBOL, 1234e8);
    }

    function test_RevertWhen_PushZeroPrice() public {
        _register();
        vm.prank(keeper);
        vm.expectRevert(IPriceOracle.ZeroPrice.selector);
        oracle.pushPrice(SYMBOL, 0);
    }

    function test_RevertWhen_PushUnknownFeed() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IPriceOracle.UnknownFeed.selector, SYMBOL));
        oracle.pushPrice(SYMBOL, 1234e8);
    }

    function test_RevertWhen_LatestPriceStale_AfterHeartbeat() public {
        _register();
        vm.prank(keeper);
        oracle.pushPrice(SYMBOL, 1234e8);

        uint64 pushedAt = uint64(block.timestamp);
        vm.warp(block.timestamp + HEARTBEAT + 1);
        vm.expectRevert(abi.encodeWithSelector(IPriceOracle.StalePrice.selector, SYMBOL, pushedAt, HEARTBEAT));
        oracle.latestPrice(SYMBOL);
    }

    function test_RevertWhen_LatestPriceBeforeAnyPush() public {
        _register();
        vm.expectRevert(abi.encodeWithSelector(IPriceOracle.StalePrice.selector, SYMBOL, uint64(0), HEARTBEAT));
        oracle.latestPrice(SYMBOL);
    }

    function test_LatestPriceUnsafe_ReturnsStale() public {
        _register();
        vm.prank(keeper);
        oracle.pushPrice(SYMBOL, 1234e8);
        vm.warp(block.timestamp + HEARTBEAT + 100);

        (uint256 price,) = oracle.latestPriceUnsafe(SYMBOL);
        assertEq(price, 1234e8);
    }

    function test_RevertWhen_UnsafeUnknownFeed() public {
        vm.expectRevert(abi.encodeWithSelector(IPriceOracle.UnknownFeed.selector, SYMBOL));
        oracle.latestPriceUnsafe(SYMBOL);
    }

    function test_DeactivateFeed() public {
        _register();
        vm.prank(keeper);
        oracle.pushPrice(SYMBOL, 1234e8);

        vm.expectEmit(true, false, false, false, address(oracle));
        emit FeedDeactivated(SYMBOL);
        vm.prank(poolMgr);
        oracle.deactivateFeed(SYMBOL);

        assertFalse(oracle.feedOf(SYMBOL).active);
        vm.expectRevert(abi.encodeWithSelector(IPriceOracle.FeedInactive.selector, SYMBOL));
        oracle.latestPrice(SYMBOL);
    }

    function test_RevertWhen_PushToDeactivated() public {
        _register();
        vm.prank(poolMgr);
        oracle.deactivateFeed(SYMBOL);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IPriceOracle.FeedInactive.selector, SYMBOL));
        oracle.pushPrice(SYMBOL, 1234e8);
    }
}
