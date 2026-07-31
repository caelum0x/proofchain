// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { OffsetMarketplace } from "../../src/esg/OffsetMarketplace.sol";
import { CarbonCreditToken } from "../../src/esg/CarbonCreditToken.sol";
import { SustainabilityOracle } from "../../src/esg/SustainabilityOracle.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IOffsetMarketplace } from "../../src/interfaces/IOffsetMarketplace.sol";
import { IERC1155Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract OffsetMarketplaceTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    SustainabilityOracle internal oracle;
    CarbonCreditToken internal credit;
    OffsetMarketplace internal market;

    address internal admin = address(0xA11CE);
    address internal keeper = address(0xC0FFEE);
    address internal alice = address(0xA71CE);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("origin");
    uint256 internal constant PROJECT = 7;

    event Offset(bytes32 indexed batchId, address indexed account, uint256 projectId, uint256 amount);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        oracle = new SustainabilityOracle(address(book), admin);
        credit = new CarbonCreditToken(address(book), admin, "ipfs://carbon/{id}");
        market = new OffsetMarketplace(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        book.setAddress(Keys.SUSTAINABILITY_ORACLE, address(oracle));
        book.setAddress(Keys.CARBON_CREDIT_TOKEN, address(credit));
        book.setAddress(Keys.OFFSET_MARKETPLACE, address(market));

        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerBatch(BATCH, ORIGIN, "ipfs://meta");

        // Keeper feeds a 500g CO2e footprint for the batch.
        oracle.grantRole(Roles.KEEPER_ROLE, keeper);
        vm.stopPrank();

        vm.prank(keeper);
        oracle.pushEmissions(BATCH, 500);

        // Alice holds carbon credits and approves the marketplace to retire them.
        vm.prank(admin);
        credit.mint(alice, PROJECT, 1000);
        vm.prank(alice);
        credit.setApprovalForAll(address(market), true);
    }

    function test_Offset_HappyPath() public {
        assertEq(market.remainingFootprint(BATCH), 500);

        vm.expectEmit(true, true, false, true, address(market));
        emit Offset(BATCH, alice, PROJECT, 500);

        vm.prank(alice);
        market.offset(BATCH, PROJECT, 500);

        // Footprint fully offset; credits burned + retired counter bumped.
        assertEq(market.remainingFootprint(BATCH), 0);
        assertEq(market.offsettedOf(BATCH), 500);
        assertEq(credit.balanceOf(alice, PROJECT), 500);
        assertEq(credit.retiredOf(PROJECT), 500);
    }

    function test_Offset_PartialThenRemaining() public {
        vm.startPrank(alice);
        market.offset(BATCH, PROJECT, 200);
        assertEq(market.remainingFootprint(BATCH), 300);
        market.offset(BATCH, PROJECT, 300);
        vm.stopPrank();

        assertEq(market.remainingFootprint(BATCH), 0);
        assertEq(market.offsettedOf(BATCH), 500);
    }

    function test_Offset_OverRetireClampsToZero() public {
        vm.startPrank(alice);
        market.offset(BATCH, PROJECT, 400);
        // 400 < 500 so still offsettable; retire 300 more -> 700 total > 500 footprint.
        market.offset(BATCH, PROJECT, 300);
        vm.stopPrank();

        assertEq(market.offsettedOf(BATCH), 700);
        assertEq(market.remainingFootprint(BATCH), 0);
    }

    function test_RevertWhen_ZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(IOffsetMarketplace.ZeroAmount.selector);
        market.offset(BATCH, PROJECT, 0);
    }

    function test_RevertWhen_NoFootprint() public {
        bytes32 other = keccak256("no-emissions");
        vm.startPrank(admin);
        registry.registerBatch(other, ORIGIN, "ipfs://meta2");
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IOffsetMarketplace.NothingToOffset.selector, other));
        market.offset(other, PROJECT, 100);
    }

    function test_RevertWhen_AlreadyFullyOffset() public {
        vm.startPrank(alice);
        market.offset(BATCH, PROJECT, 500);
        vm.expectRevert(abi.encodeWithSelector(IOffsetMarketplace.NothingToOffset.selector, BATCH));
        market.offset(BATCH, PROJECT, 100);
        vm.stopPrank();
    }

    function test_RevertWhen_MarketplaceNotApproved() public {
        // Bob holds credits but never approved the marketplace as operator.
        address bob = address(0xB0B);
        vm.prank(admin);
        credit.mint(bob, PROJECT, 1000);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IERC1155Errors.ERC1155MissingApprovalForAll.selector, address(market), bob)
        );
        market.offset(BATCH, PROJECT, 100);
    }

    function test_RemainingFootprint_UnsetBatchIsZero() public view {
        assertEq(market.remainingFootprint(keccak256("never")), 0);
    }
}
