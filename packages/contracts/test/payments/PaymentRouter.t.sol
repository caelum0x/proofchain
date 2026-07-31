// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Treasury } from "../../src/payments/Treasury.sol";
import { FeeManager } from "../../src/payments/FeeManager.sol";
import { StablecoinRegistry } from "../../src/payments/StablecoinRegistry.sol";
import { PaymentRouter } from "../../src/payments/PaymentRouter.sol";
import { IPaymentRouter } from "../../src/interfaces/IPaymentRouter.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract PaymentRouterTest is Test {
    AddressBook internal book;
    Treasury internal treasury;
    FeeManager internal feeManager;
    StablecoinRegistry internal registry;
    PaymentRouter internal router;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal payer = address(0xBEEF01);
    address internal destination = address(0x600D);
    address internal keeper = address(0x11EE);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant PAY = keccak256("PAY");
    uint256 internal constant AMOUNT = 1_000e6;

    event Routed(
        bytes32 indexed action,
        address indexed token,
        address indexed payer,
        address destination,
        uint256 amount,
        uint256 fee
    );

    function setUp() public {
        book = new AddressBook(admin);
        treasury = new Treasury(address(book), admin);
        feeManager = new FeeManager(address(book), admin);
        registry = new StablecoinRegistry(address(book), admin);
        router = new PaymentRouter(address(book), admin);
        usdc = new MockUSDC();

        vm.startPrank(admin);
        book.setAddress(Keys.TREASURY, address(treasury));
        book.setAddress(Keys.FEE_MANAGER, address(feeManager));
        book.setAddress(Keys.STABLECOIN_REGISTRY, address(registry));
        registry.addToken(address(usdc), 6);
        feeManager.setFeeBps(PAY, 100); // 1%
        router.grantRole(Roles.KEEPER_ROLE, keeper);
        vm.stopPrank();

        usdc.mint(payer, AMOUNT);
    }

    function test_Pay_SkimsFeeAndForwardsNet() public {
        vm.prank(payer);
        usdc.approve(address(router), AMOUNT);

        vm.expectEmit(true, true, true, true);
        emit Routed(PAY, address(usdc), payer, destination, 990e6, 10e6);
        vm.prank(payer);
        uint256 net = router.pay(PAY, address(usdc), destination, AMOUNT);

        assertEq(net, 990e6);
        assertEq(usdc.balanceOf(destination), 990e6);
        assertEq(treasury.balanceOf(address(usdc)), 10e6);
        assertEq(usdc.balanceOf(payer), 0);
        // Router keeps nothing and leaves no residual allowance to the fee manager.
        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(usdc.allowance(address(router), address(feeManager)), 0);
    }

    function test_Pay_ZeroFeeForwardsFull() public {
        vm.prank(admin);
        feeManager.setFeeBps(PAY, 0);

        vm.prank(payer);
        usdc.approve(address(router), AMOUNT);
        vm.prank(payer);
        uint256 net = router.pay(PAY, address(usdc), destination, AMOUNT);

        assertEq(net, AMOUNT);
        assertEq(usdc.balanceOf(destination), AMOUNT);
        assertEq(treasury.balanceOf(address(usdc)), 0);
    }

    function test_Pay_RevertsTokenNotAccepted() public {
        MockUSDC other = new MockUSDC();
        other.mint(payer, AMOUNT);
        vm.prank(payer);
        other.approve(address(router), AMOUNT);

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(IPaymentRouter.TokenNotAccepted.selector, address(other)));
        router.pay(PAY, address(other), destination, AMOUNT);
    }

    function test_Pay_RevertsZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(IPaymentRouter.ZeroAmount.selector);
        router.pay(PAY, address(usdc), destination, 0);
    }

    function test_Pay_RevertsZeroDestination() public {
        vm.prank(payer);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        router.pay(PAY, address(usdc), address(0), AMOUNT);
    }

    function test_Route_KeeperCanRouteOnBehalf() public {
        vm.prank(payer);
        usdc.approve(address(router), AMOUNT);

        vm.prank(keeper);
        uint256 net = router.route(PAY, address(usdc), payer, destination, AMOUNT);
        assertEq(net, 990e6);
        assertEq(usdc.balanceOf(destination), 990e6);
    }

    function test_Route_RevertsUnauthorizedThirdParty() public {
        vm.prank(payer);
        usdc.approve(address(router), AMOUNT);

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(PaymentRouter.UnauthorizedRouter.selector, stranger, payer)
        );
        router.route(PAY, address(usdc), payer, destination, AMOUNT);
    }

    function test_Route_PayerCanRouteThemselves() public {
        vm.prank(payer);
        usdc.approve(address(router), AMOUNT);
        vm.prank(payer);
        uint256 net = router.route(PAY, address(usdc), payer, destination, AMOUNT);
        assertEq(net, 990e6);
    }
}
