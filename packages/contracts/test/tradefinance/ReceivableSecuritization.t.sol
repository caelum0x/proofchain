// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ReceivableSecuritization } from "../../src/tradefinance/ReceivableSecuritization.sol";
import { IReceivableSecuritization } from "../../src/interfaces/IReceivableSecuritization.sol";
import { TrancheToken } from "../../src/tradefinance/TrancheToken.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockAttestation } from "./mocks/MockAttestation.sol";

contract ReceivableSecuritizationTest is Test {
    AddressBook internal book;
    ReceivableSecuritization internal sec;
    MockAttestation internal att;
    MockUSDC internal usdc;

    TrancheToken internal senior;
    TrancheToken internal junior;

    address internal admin = address(0xA11CE);
    address internal sponsor = address(0x590);
    address internal seniorInvestor = address(0x51);
    address internal juniorInvestor = address(0x11);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant POOL = keccak256("pool-1");
    bytes32 internal constant BATCH = keccak256("batch-1");

    uint256 internal constant SENIOR_PRINCIPAL = 700e6;
    uint16 internal constant SENIOR_COUPON = 500; // 5% -> target 735e6
    uint256 internal constant JUNIOR_PRINCIPAL = 300e6;

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        sec = new ReceivableSecuritization(address(book), admin);
        att = new MockAttestation();
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        vm.stopPrank();

        usdc = new MockUSDC();
        att.setAttested(BATCH, true, 9600);

        // Tranche tokens: securitization is the burner (MINTER_ROLE); admin seeds primary issuance.
        senior = new TrancheToken("Senior", "SEN", POOL, 0, admin, address(sec));
        junior = new TrancheToken("Junior", "JUN", POOL, 1, admin, address(sec));
        vm.startPrank(admin);
        senior.grantRole(Roles.MINTER_ROLE, admin);
        junior.grantRole(Roles.MINTER_ROLE, admin);
        senior.mint(seniorInvestor, 700e18);
        junior.mint(juniorInvestor, 300e18);
        vm.stopPrank();

        // Fund the servicer (sponsor) to pay in collections.
        usdc.mint(sponsor, 10_000e6);
        vm.prank(sponsor);
        usdc.approve(address(sec), type(uint256).max);
    }

    function _buildSealedPool() internal {
        vm.startPrank(sponsor);
        sec.createPool(POOL, address(usdc));
        sec.addReceivable(POOL, BATCH, 1_000e6);
        sec.defineTranche(POOL, 0, address(senior), 0, SENIOR_PRINCIPAL, SENIOR_COUPON);
        sec.defineTranche(POOL, 1, address(junior), 1, JUNIOR_PRINCIPAL, 0);
        sec.seal(POOL);
        vm.stopPrank();
    }

    function test_CreatePool_Happy() public {
        vm.prank(sponsor);
        sec.createPool(POOL, address(usdc));
        IReceivableSecuritization.Pool memory p = sec.poolOf(POOL);
        assertEq(p.sponsor, sponsor);
        assertEq(uint8(p.state), uint8(IReceivableSecuritization.PoolState.Open));
    }

    function test_Revert_AddReceivable_NotSponsor() public {
        vm.prank(sponsor);
        sec.createPool(POOL, address(usdc));
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IReceivableSecuritization.NotSponsor.selector, POOL));
        sec.addReceivable(POOL, BATCH, 1_000e6);
    }

    function test_Revert_AddReceivable_NotAttested() public {
        vm.prank(sponsor);
        sec.createPool(POOL, address(usdc));
        att.setAttested(BATCH, false, 0);
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(IReceivableSecuritization.NotAttested.selector, BATCH));
        sec.addReceivable(POOL, BATCH, 1_000e6);
    }

    function test_Revert_DefineTranche_UnexpectedIndex() public {
        vm.startPrank(sponsor);
        sec.createPool(POOL, address(usdc));
        vm.expectRevert(abi.encodeWithSelector(ReceivableSecuritization.UnexpectedTrancheIndex.selector, uint8(0), uint8(1)));
        sec.defineTranche(POOL, 1, address(senior), 0, SENIOR_PRINCIPAL, SENIOR_COUPON);
        vm.stopPrank();
    }

    function test_Revert_Seal_NoTranches() public {
        vm.startPrank(sponsor);
        sec.createPool(POOL, address(usdc));
        vm.expectRevert(abi.encodeWithSelector(ReceivableSecuritization.NoTranches.selector, POOL));
        sec.seal(POOL);
        vm.stopPrank();
    }

    function test_Waterfall_SeniorFirst() public {
        _buildSealedPool();

        // Collect 800e6 — enough to fully cover senior (735e6), remainder (65e6) to junior.
        vm.prank(sponsor);
        sec.collect(POOL, 800e6);

        sec.distribute(POOL);

        // Senior fully covered to principal + 5% coupon.
        assertEq(sec.trancheCashOf(POOL, 0), 735e6);
        // Junior receives only the residual.
        assertEq(sec.trancheCashOf(POOL, 1), 65e6);
        assertEq(sec.totalDistributedOf(POOL), 800e6);
        assertEq(uint8(sec.poolOf(POOL).state), uint8(IReceivableSecuritization.PoolState.Distributing));
    }

    function test_Revert_Distribute_NothingToDistribute() public {
        _buildSealedPool();
        vm.expectRevert(abi.encodeWithSelector(IReceivableSecuritization.NothingToDistribute.selector, POOL));
        sec.distribute(POOL);
    }

    function test_Redeem_ProRataCash() public {
        _buildSealedPool();
        vm.prank(sponsor);
        sec.collect(POOL, 800e6);
        sec.distribute(POOL);

        // Senior investor redeems ALL senior shares -> full senior pot (735e6).
        vm.prank(seniorInvestor);
        sec.redeem(POOL, 0, 700e18);
        assertEq(usdc.balanceOf(seniorInvestor), 735e6);
        assertEq(senior.balanceOf(seniorInvestor), 0);
        assertEq(sec.trancheCashOf(POOL, 0), 0);

        // Junior investor redeems HALF -> half the junior pot (32.5e6).
        vm.prank(juniorInvestor);
        sec.redeem(POOL, 1, 150e18);
        assertEq(usdc.balanceOf(juniorInvestor), 32_500_000);
        assertEq(junior.balanceOf(juniorInvestor), 150e18);
        assertEq(sec.trancheCashOf(POOL, 1), 32_500_000);

        // No cash stranded beyond the still-unredeemed junior pot.
        assertEq(usdc.balanceOf(address(sec)), 32_500_000);
    }

    function test_Redeem_SortHandlesReversedSeniority() public {
        // Define index0 = junior seniority(1), index1 = senior seniority(0): sort must pay index1 first.
        vm.startPrank(sponsor);
        sec.createPool(POOL, address(usdc));
        sec.addReceivable(POOL, BATCH, 1_000e6);
        sec.defineTranche(POOL, 0, address(junior), 1, JUNIOR_PRINCIPAL, 0); // junior in slot 0
        sec.defineTranche(POOL, 1, address(senior), 0, SENIOR_PRINCIPAL, SENIOR_COUPON); // senior in slot 1
        sec.seal(POOL);
        sec.collect(POOL, 800e6);
        vm.stopPrank();

        sec.distribute(POOL);

        // Despite slot order, the senior (seniority 0, slot 1) is paid first to its 735e6 target.
        assertEq(sec.trancheCashOf(POOL, 1), 735e6);
        assertEq(sec.trancheCashOf(POOL, 0), 65e6);
    }

    function test_Revert_Redeem_UnknownTranche() public {
        _buildSealedPool();
        vm.prank(seniorInvestor);
        vm.expectRevert(abi.encodeWithSelector(IReceivableSecuritization.UnknownTranche.selector, POOL, uint8(5)));
        sec.redeem(POOL, 5, 1);
    }
}
