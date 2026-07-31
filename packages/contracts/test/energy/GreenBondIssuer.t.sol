// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { GreenBondIssuer } from "../../src/energy/GreenBondIssuer.sol";
import { IGreenBondIssuer } from "../../src/interfaces/IGreenBondIssuer.sol";
import { StablecoinRegistry } from "../../src/payments/StablecoinRegistry.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract GreenBondIssuerTest is Test {
    AddressBook internal book;
    GreenBondIssuer internal gbi;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal issuer = address(0x155E);
    address internal alice = address(0xA71CE);
    address internal bob = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BOND = keccak256("green-bond-1");
    bytes32 internal constant CATEGORY = keccak256("solar-infra");
    bytes32 internal constant PROJECT = keccak256("solar-plant-7");

    uint256 internal constant TARGET = 1_000e6;

    event BondCreated(
        bytes32 indexed bondId, address indexed issuer, address token, uint256 principalTarget, uint16 couponBps, bytes32 greenCategory
    );
    event Subscribed(bytes32 indexed bondId, address indexed investor, uint256 amount);
    event OfferingClosed(bytes32 indexed bondId, uint256 principalRaised);
    event CouponFunded(bytes32 indexed bondId, uint16 indexed period, uint256 amount);
    event CouponClaimed(bytes32 indexed bondId, address indexed investor, uint256 amount);
    event ProceedsAllocated(bytes32 indexed bondId, bytes32 indexed projectId, uint256 amount);
    event Redeemed(bytes32 indexed bondId, address indexed investor, uint256 principal);
    event BondMatured(bytes32 indexed bondId);

    function setUp() public {
        book = new AddressBook(admin);
        gbi = new GreenBondIssuer(address(book), admin);
        usdc = new MockUSDC();

        vm.prank(admin);
        gbi.grantRole(Roles.UNDERWRITER_ROLE, issuer);

        // Fund investors and the issuer; approve the bond contract to pull.
        usdc.mint(alice, 600e6);
        usdc.mint(bob, 400e6);
        usdc.mint(issuer, 200e6); // for coupon funding beyond returned proceeds
        vm.prank(alice);
        usdc.approve(address(gbi), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(gbi), type(uint256).max);
        vm.prank(issuer);
        usdc.approve(address(gbi), type(uint256).max);
    }

    function _create() internal {
        vm.prank(issuer);
        gbi.createBond(BOND, address(usdc), TARGET, 500, 365, 4, CATEGORY);
    }

    function _raise() internal {
        _create();
        vm.prank(alice);
        gbi.subscribe(BOND, 600e6);
        vm.prank(bob);
        gbi.subscribe(BOND, 400e6);
    }

    function _activate() internal {
        _raise();
        vm.prank(issuer);
        gbi.closeOffering(BOND);
    }

    // ------------------------------------------------------------- create

    function test_Create_Happy() public {
        vm.expectEmit(true, true, false, true, address(gbi));
        emit BondCreated(BOND, issuer, address(usdc), TARGET, 500, CATEGORY);
        _create();
        IGreenBondIssuer.Bond memory b = gbi.bondOf(BOND);
        assertEq(b.issuer, issuer);
        assertEq(b.token, address(usdc));
        assertEq(b.principalTarget, TARGET);
        assertEq(uint8(b.state), uint8(IGreenBondIssuer.BondState.Offering));
    }

    function test_Revert_Create_NotUnderwriter() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.UNDERWRITER_ROLE)
        );
        gbi.createBond(BOND, address(usdc), TARGET, 500, 365, 4, CATEGORY);
    }

    function test_Revert_Create_Exists() public {
        _create();
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.BondExists.selector, BOND));
        gbi.createBond(BOND, address(usdc), TARGET, 500, 365, 4, CATEGORY);
    }

    function test_Revert_Create_InvalidTerms() public {
        vm.prank(issuer);
        vm.expectRevert(IGreenBondIssuer.InvalidTerms.selector);
        gbi.createBond(BOND, address(usdc), 0, 500, 365, 4, CATEGORY);
    }

    function test_Revert_Create_ZeroPeriods() public {
        vm.prank(issuer);
        vm.expectRevert(IGreenBondIssuer.InvalidTerms.selector);
        gbi.createBond(BOND, address(usdc), TARGET, 500, 365, 0, CATEGORY);
    }

    // ------------------------------------------------------------- subscribe

    function test_Subscribe_MovesFunds() public {
        _create();
        vm.expectEmit(true, true, false, true, address(gbi));
        emit Subscribed(BOND, alice, 600e6);
        vm.prank(alice);
        gbi.subscribe(BOND, 600e6);

        assertEq(usdc.balanceOf(address(gbi)), 600e6);
        assertEq(usdc.balanceOf(alice), 0);
        assertEq(gbi.holdingOf(BOND, alice).principal, 600e6);
        assertEq(gbi.bondOf(BOND).principalRaised, 600e6);
    }

    function test_Revert_Subscribe_TargetExceeded() public {
        _create();
        vm.prank(alice);
        gbi.subscribe(BOND, 600e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.TargetExceeded.selector, BOND, 500e6, 400e6));
        gbi.subscribe(BOND, 500e6);
    }

    function test_Revert_Subscribe_UnknownBond() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.UnknownBond.selector, BOND));
        gbi.subscribe(BOND, 100e6);
    }

    function test_Revert_Subscribe_ZeroAmount() public {
        _create();
        vm.prank(alice);
        vm.expectRevert(IGreenBondIssuer.ZeroAmount.selector);
        gbi.subscribe(BOND, 0);
    }

    // ------------------------------------------------------------- close

    function test_Close_Happy() public {
        _raise();
        vm.expectEmit(true, false, false, true, address(gbi));
        emit OfferingClosed(BOND, TARGET);
        vm.prank(issuer);
        gbi.closeOffering(BOND);
        IGreenBondIssuer.Bond memory b = gbi.bondOf(BOND);
        assertEq(uint8(b.state), uint8(IGreenBondIssuer.BondState.Active));
        assertEq(b.maturesAt, uint64(b.issuedAt + uint256(365) * 1 days));
    }

    function test_Revert_Close_NotIssuer() public {
        _raise();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.NotIssuer.selector, BOND));
        gbi.closeOffering(BOND);
    }

    function test_Revert_Close_NoSubscriptions() public {
        _create();
        vm.prank(issuer);
        vm.expectRevert(IGreenBondIssuer.ZeroAmount.selector);
        gbi.closeOffering(BOND);
    }

    // ------------------------------------------------------------- proceeds

    function test_AllocateProceeds_MovesToIssuer() public {
        _activate();
        uint256 issuerBefore = usdc.balanceOf(issuer);
        vm.expectEmit(true, true, false, true, address(gbi));
        emit ProceedsAllocated(BOND, PROJECT, TARGET);
        vm.prank(issuer);
        gbi.allocateProceeds(BOND, PROJECT, TARGET);

        assertEq(usdc.balanceOf(issuer), issuerBefore + TARGET);
        assertEq(gbi.proceedsAllocated(BOND), TARGET);
        assertEq(usdc.balanceOf(address(gbi)), 0);
    }

    function test_Revert_AllocateProceeds_OverRaised() public {
        _activate();
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.TargetExceeded.selector, BOND, TARGET + 1, TARGET));
        gbi.allocateProceeds(BOND, PROJECT, TARGET + 1);
    }

    function test_Revert_AllocateProceeds_NotIssuer() public {
        _activate();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.NotIssuer.selector, BOND));
        gbi.allocateProceeds(BOND, PROJECT, 100e6);
    }

    // ------------------------------------------------------------- coupons (pro-rata)

    function test_Coupon_ProRataClaims() public {
        _activate();

        // Fund coupon period 0 with 100 USDC pool.
        vm.expectEmit(true, true, false, true, address(gbi));
        emit CouponFunded(BOND, 0, 100e6);
        vm.prank(issuer);
        gbi.fundCoupon(BOND, 0, 100e6);

        // alice holds 60% principal, bob 40%.
        assertEq(gbi.claimableCoupon(BOND, alice), 60e6);
        assertEq(gbi.claimableCoupon(BOND, bob), 40e6);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.expectEmit(true, true, false, true, address(gbi));
        emit CouponClaimed(BOND, alice, 60e6);
        vm.prank(alice);
        uint256 got = gbi.claimCoupon(BOND);
        assertEq(got, 60e6);
        assertEq(usdc.balanceOf(alice), aliceBefore + 60e6);
        assertEq(gbi.claimableCoupon(BOND, alice), 0);

        // Fund a second period; alice's incremental entitlement accrues.
        vm.prank(issuer);
        gbi.fundCoupon(BOND, 1, 50e6);
        assertEq(gbi.claimableCoupon(BOND, alice), 30e6); // 60% of 50
        assertEq(gbi.claimableCoupon(BOND, bob), 60e6); // 40% of 150 total, none claimed
    }

    function test_Revert_FundCoupon_InvalidPeriod() public {
        _activate();
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.InvalidPeriod.selector, BOND, uint16(4)));
        gbi.fundCoupon(BOND, 4, 10e6);
    }

    function test_Revert_FundCoupon_DoubleFunded() public {
        _activate();
        vm.startPrank(issuer);
        gbi.fundCoupon(BOND, 0, 100e6);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.CouponPeriodFunded.selector, BOND, uint16(0)));
        gbi.fundCoupon(BOND, 0, 10e6);
        vm.stopPrank();
    }

    function test_Revert_FundCoupon_NotIssuer() public {
        _activate();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.NotIssuer.selector, BOND));
        gbi.fundCoupon(BOND, 0, 10e6);
    }

    function test_Revert_ClaimCoupon_Nothing() public {
        _activate();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.NothingToClaim.selector, BOND, alice));
        gbi.claimCoupon(BOND);
    }

    // ------------------------------------------------------------- maturity + redeem

    function test_Redeem_FullCycle() public {
        _activate();
        vm.prank(issuer);
        gbi.allocateProceeds(BOND, PROJECT, TARGET);

        // Issuer repays principal at maturity.
        vm.expectEmit(true, false, false, false, address(gbi));
        emit BondMatured(BOND);
        vm.prank(issuer);
        gbi.repayPrincipal(BOND);
        assertEq(uint8(gbi.bondOf(BOND).state), uint8(IGreenBondIssuer.BondState.Matured));
        assertEq(usdc.balanceOf(address(gbi)), TARGET);

        // Investors redeem their principal.
        vm.expectEmit(true, true, false, true, address(gbi));
        emit Redeemed(BOND, alice, 600e6);
        vm.prank(alice);
        assertEq(gbi.redeem(BOND), 600e6);
        vm.prank(bob);
        assertEq(gbi.redeem(BOND), 400e6);

        assertEq(usdc.balanceOf(alice), 600e6);
        assertEq(usdc.balanceOf(bob), 400e6);
        assertEq(usdc.balanceOf(address(gbi)), 0);
    }

    function test_Revert_Redeem_NotMatured() public {
        _activate();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IGreenBondIssuer.InvalidState.selector,
                BOND,
                IGreenBondIssuer.BondState.Matured,
                IGreenBondIssuer.BondState.Active
            )
        );
        gbi.redeem(BOND);
    }

    function test_Revert_Redeem_Twice() public {
        _activate();
        vm.prank(issuer);
        gbi.allocateProceeds(BOND, PROJECT, TARGET);
        vm.prank(issuer);
        gbi.repayPrincipal(BOND);
        vm.startPrank(alice);
        gbi.redeem(BOND);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.NothingToRedeem.selector, BOND, alice));
        gbi.redeem(BOND);
        vm.stopPrank();
    }

    function test_Revert_RepayPrincipal_NotIssuer() public {
        _activate();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.NotIssuer.selector, BOND));
        gbi.repayPrincipal(BOND);
    }

    // ------------------------------------------------------------- default

    function test_MarkDefaulted_ByUnderwriter() public {
        _activate();
        vm.prank(issuer); // holds UNDERWRITER_ROLE
        gbi.markDefaulted(BOND);
        assertEq(uint8(gbi.bondOf(BOND).state), uint8(IGreenBondIssuer.BondState.Defaulted));
    }

    function test_Revert_MarkDefaulted_Unauthorized() public {
        _activate();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.NotIssuer.selector, BOND));
        gbi.markDefaulted(BOND);
    }

    // ------------------------------------------------------------- cancel + refund

    function test_CancelAndRefund() public {
        _raise();
        vm.prank(issuer);
        gbi.cancelBond(BOND);
        assertEq(uint8(gbi.bondOf(BOND).state), uint8(IGreenBondIssuer.BondState.Cancelled));

        vm.prank(alice);
        assertEq(gbi.refund(BOND), 600e6);
        vm.prank(bob);
        assertEq(gbi.refund(BOND), 400e6);

        assertEq(usdc.balanceOf(alice), 600e6);
        assertEq(usdc.balanceOf(bob), 400e6);
        assertEq(usdc.balanceOf(address(gbi)), 0);
    }

    function test_Revert_Refund_Twice() public {
        _raise();
        vm.prank(issuer);
        gbi.cancelBond(BOND);
        vm.startPrank(alice);
        gbi.refund(BOND);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.NothingToRedeem.selector, BOND, alice));
        gbi.refund(BOND);
        vm.stopPrank();
    }

    function test_Revert_Cancel_NotIssuer() public {
        _raise();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IGreenBondIssuer.NotIssuer.selector, BOND));
        gbi.cancelBond(BOND);
    }

    // ------------------------------------------------------------- token acceptance (registry wired)

    function test_Revert_Create_TokenNotAccepted() public {
        // Wire a StablecoinRegistry that only accepts usdc; a different token is rejected.
        vm.startPrank(admin);
        StablecoinRegistry reg = new StablecoinRegistry(address(book), admin);
        reg.addToken(address(usdc), 6);
        book.setAddress(Keys.STABLECOIN_REGISTRY, address(reg));
        vm.stopPrank();

        MockUSDC other = new MockUSDC();
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(GreenBondIssuer.TokenNotAccepted.selector, address(other)));
        gbi.createBond(BOND, address(other), TARGET, 500, 365, 4, CATEGORY);
    }

    function test_Create_AcceptedToken_Passes() public {
        vm.startPrank(admin);
        StablecoinRegistry reg = new StablecoinRegistry(address(book), admin);
        reg.addToken(address(usdc), 6);
        book.setAddress(Keys.STABLECOIN_REGISTRY, address(reg));
        vm.stopPrank();

        _create(); // usdc is accepted -> succeeds
        assertEq(uint8(gbi.bondOf(BOND).state), uint8(IGreenBondIssuer.BondState.Offering));
    }
}
