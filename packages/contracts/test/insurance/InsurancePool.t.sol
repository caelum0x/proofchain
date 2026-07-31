// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { InsuranceFixture } from "./InsuranceFixture.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { IInsurancePool } from "../../src/interfaces/IInsurancePool.sol";

contract InsurancePoolTest is InsuranceFixture {
    event Deposited(address indexed provider, address indexed token, uint256 amount);
    event Withdrawn(address indexed provider, address indexed token, uint256 amount);
    event PaidOut(bytes32 indexed policyId, address indexed to, uint256 amount);

    // ---------------------------------------------------------------------
    // deposit / withdraw
    // ---------------------------------------------------------------------

    function test_Deposit_CreditsCapital() public view {
        assertEq(pool.totalCapital(address(usdc)), LP_CAPITAL);
        assertEq(pool.availableCapital(address(usdc)), LP_CAPITAL);
        assertEq(pool.reservedCapital(), 0);
        assertEq(pool.depositOf(lp, address(usdc)), LP_CAPITAL);
    }

    function test_Deposit_RevertsZeroAmount() public {
        vm.prank(lp);
        vm.expectRevert(IInsurancePool.ZeroAmount.selector);
        pool.deposit(address(usdc), 0);
    }

    function test_Deposit_RevertsTokenNotAccepted() public {
        MockUSDC other = new MockUSDC();
        other.mint(lp, 1_000e6);
        vm.startPrank(lp);
        other.approve(address(pool), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(IInsurancePool.TokenNotAccepted.selector, address(other)));
        pool.deposit(address(other), 1_000e6);
        vm.stopPrank();
    }

    function test_Withdraw_HappyPath() public {
        vm.expectEmit(true, true, false, true);
        emit Withdrawn(lp, address(usdc), 4_000e6);
        vm.prank(lp);
        pool.withdraw(address(usdc), 4_000e6);

        assertEq(pool.depositOf(lp, address(usdc)), LP_CAPITAL - 4_000e6);
        assertEq(pool.availableCapital(address(usdc)), LP_CAPITAL - 4_000e6);
        assertEq(usdc.balanceOf(lp), 4_000e6);
    }

    function test_Withdraw_RevertsExceedsDeposit() public {
        vm.prank(lp);
        vm.expectRevert(
            abi.encodeWithSelector(IInsurancePool.InsufficientCapital.selector, LP_CAPITAL + 1, LP_CAPITAL)
        );
        pool.withdraw(address(usdc), LP_CAPITAL + 1);
    }

    function test_Withdraw_RevertsWhenCapitalReserved() public {
        _buyPolicy(); // reserves COVERAGE against LP capital
        uint256 premiumPaid = _expectedPremium(COVERAGE, SUPPLIER_GRADE);
        uint256 free = LP_CAPITAL + premiumPaid - COVERAGE;

        vm.prank(lp);
        vm.expectRevert(abi.encodeWithSelector(IInsurancePool.InsufficientCapital.selector, LP_CAPITAL, free));
        pool.withdraw(address(usdc), LP_CAPITAL);
    }

    // ---------------------------------------------------------------------
    // underwrite (driven through PolicyManager)
    // ---------------------------------------------------------------------

    function test_Underwrite_ReservesCapital() public {
        _buyPolicy();
        assertEq(pool.reservedCapital(), COVERAGE);
        // Premium was routed into the pool as capital.
        uint256 premiumPaid = _expectedPremium(COVERAGE, SUPPLIER_GRADE);
        assertEq(pool.totalCapital(address(usdc)), LP_CAPITAL + premiumPaid);
        assertEq(pool.availableCapital(address(usdc)), LP_CAPITAL + premiumPaid - COVERAGE);
    }

    function test_Underwrite_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IInsurancePool.NotAuthorized.selector, stranger));
        pool.underwrite(keccak256("p"), COVERAGE);
    }

    // ---------------------------------------------------------------------
    // payout (driven through ClaimsProcessor)
    // ---------------------------------------------------------------------

    function test_Payout_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IInsurancePool.NotAuthorized.selector, stranger));
        pool.payout(keccak256("p"), holder, COVERAGE);
    }

    function test_Payout_PaysClaimantAndReleasesReservation() public {
        bytes32 policyId = _buyPolicy();
        bytes32 claimId = _fileAndApprove(policyId, COVERAGE);

        uint256 holderBefore = usdc.balanceOf(holder);
        vm.expectEmit(true, true, false, true);
        emit PaidOut(policyId, holder, COVERAGE);
        claims.payout(claimId); // permissionless once approved

        assertEq(usdc.balanceOf(holder), holderBefore + COVERAGE);
        assertEq(pool.reservedCapital(), 0);
    }

    // ---------------------------------------------------------------------
    // reinsurance (RiskPool) tail-loss path
    // ---------------------------------------------------------------------

    function test_Underwrite_UsesRiskPoolWhenPoolShort() public {
        // Coverage exceeds free pool capital; RiskPool must back the remainder.
        uint256 bigCoverage = LP_CAPITAL + 5_000e6; // 15_000e6

        // Seed the reinsurance tranche.
        usdc.mint(address(this), 6_000e6);
        usdc.approve(address(risk), type(uint256).max);
        risk.topUp(address(usdc), 6_000e6);

        // Fund the holder for the (larger) premium and buy.
        uint256 expectedPremium = _expectedPremium(bigCoverage, SUPPLIER_GRADE);
        usdc.mint(holder, expectedPremium);
        vm.prank(holder);
        bytes32 policyId = policyMgr.buyPolicy(BATCH, address(usdc), bigCoverage);

        // Pool reserved only up to its free capital; the rest is reinsured.
        uint256 poolBacked = LP_CAPITAL + expectedPremium; // free capital at underwrite time
        assertEq(pool.reservedCapital(), poolBacked);

        // File + approve + pay the full coverage; claimant receives pool + reinsurance funds.
        bytes32 claimId = _fileAndApprove(policyId, bigCoverage);
        uint256 holderBefore = usdc.balanceOf(holder);
        claims.payout(claimId);

        assertEq(usdc.balanceOf(holder), holderBefore + bigCoverage);
        assertEq(pool.reservedCapital(), 0);
        // RiskPool covered the shortfall.
        assertEq(risk.reserves(address(usdc)), 6_000e6 - (bigCoverage - poolBacked));
    }

    function test_Underwrite_RevertsWhenNeitherPoolNorRiskCanCover() public {
        uint256 hugeCoverage = LP_CAPITAL + 100_000e6;
        uint256 expectedPremium = _expectedPremium(hugeCoverage, SUPPLIER_GRADE);
        usdc.mint(holder, expectedPremium);

        vm.prank(holder);
        // free = LP_CAPITAL + premium; RiskPool empty -> InsufficientCapital.
        vm.expectRevert(
            abi.encodeWithSelector(
                IInsurancePool.InsufficientCapital.selector, hugeCoverage, LP_CAPITAL + expectedPremium
            )
        );
        policyMgr.buyPolicy(BATCH, address(usdc), hugeCoverage);
    }
}
