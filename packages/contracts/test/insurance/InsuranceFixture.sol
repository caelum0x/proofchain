// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

import { PremiumCalculator } from "../../src/insurance/PremiumCalculator.sol";
import { InsurancePool } from "../../src/insurance/InsurancePool.sol";
import { RiskPool } from "../../src/insurance/RiskPool.sol";
import { PolicyManager } from "../../src/insurance/PolicyManager.sol";
import { ClaimsProcessor } from "../../src/insurance/ClaimsProcessor.sol";

import { MockStablecoinRegistry } from "./mocks/MockStablecoinRegistry.sol";
import { MockScoreOracle } from "./mocks/MockScoreOracle.sol";
import { MockProvenance } from "./mocks/MockProvenance.sol";
import { MockEscrow } from "./mocks/MockEscrow.sol";

/// @notice Shared deployment + wiring for the M6 insurance test-suite.
/// @dev Deploys the full insurance stack, wires the AddressBook, and provides funded actors and
///      convenience helpers so each test file can focus on behaviour.
abstract contract InsuranceFixture is Test {
    AddressBook internal book;
    MockUSDC internal usdc;
    MockStablecoinRegistry internal registry;
    MockScoreOracle internal oracle;
    MockProvenance internal prov;
    MockEscrow internal escrow;

    PremiumCalculator internal premium;
    InsurancePool internal pool;
    RiskPool internal risk;
    PolicyManager internal policyMgr;
    ClaimsProcessor internal claims;

    address internal admin = address(0xA11CE);
    address internal arbiter = address(0xA6B1);
    address internal holder = address(0xB111);
    address internal lp = address(0x11B0);
    address internal supplier = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");

    uint256 internal constant COVERAGE = 1_000e6;
    uint256 internal constant LP_CAPITAL = 10_000e6;
    uint8 internal constant SUPPLIER_GRADE = 3; // 250 bps premium

    function setUp() public virtual {
        // --- deploy core + mocks ---
        book = new AddressBook(admin);
        usdc = new MockUSDC();
        registry = new MockStablecoinRegistry();
        oracle = new MockScoreOracle();
        prov = new MockProvenance();
        escrow = new MockEscrow();

        registry.addToken(address(usdc), 6);
        oracle.setGrade(supplier, SUPPLIER_GRADE);
        prov.setSupplier(BATCH, supplier);

        // --- deploy insurance module ---
        premium = new PremiumCalculator(address(book), admin);
        pool = new InsurancePool(address(book), admin);
        risk = new RiskPool(address(book), admin);
        policyMgr = new PolicyManager(address(book), admin);
        claims = new ClaimsProcessor(address(book), admin);

        // --- wire the AddressBook ---
        vm.startPrank(admin);
        book.setAddress(Keys.STABLECOIN_REGISTRY, address(registry));
        book.setAddress(Keys.SCORE_ORACLE, address(oracle));
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(prov));
        book.setAddress(Keys.SETTLEMENT_ESCROW, address(escrow));
        book.setAddress(Keys.PREMIUM_CALCULATOR, address(premium));
        book.setAddress(Keys.INSURANCE_POOL, address(pool));
        book.setAddress(Keys.RISK_POOL, address(risk));
        book.setAddress(Keys.POLICY_MANAGER, address(policyMgr));
        book.setAddress(Keys.CLAIMS_PROCESSOR, address(claims));

        claims.grantRole(claims.ARBITER_ROLE(), arbiter);
        vm.stopPrank();

        // --- fund actors ---
        usdc.mint(lp, LP_CAPITAL);
        vm.startPrank(lp);
        usdc.approve(address(pool), type(uint256).max);
        pool.deposit(address(usdc), LP_CAPITAL);
        vm.stopPrank();

        // Holder approves the pool (premium is pulled straight into pool capital).
        usdc.mint(holder, 1_000e6);
        vm.prank(holder);
        usdc.approve(address(pool), type(uint256).max);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    function _expectedPremium(uint256 coverage, uint8 grade) internal view returns (uint256) {
        return premium.premiumFor(coverage, grade);
    }

    /// @dev Holder buys a policy on BATCH for COVERAGE. Returns the policyId.
    function _buyPolicy() internal returns (bytes32 policyId) {
        vm.prank(holder);
        policyId = policyMgr.buyPolicy(BATCH, address(usdc), COVERAGE);
    }

    /// @dev Mark BATCH's escrow deal as Disputed (proven-loss precondition for claims).
    function _proveLoss() internal {
        escrow.setDeal(BATCH, MockEscrow.DealState.Disputed);
    }

    /// @dev Full path to an approved claim of `amount` on `policyId`.
    function _fileAndApprove(bytes32 policyId, uint256 amount) internal returns (bytes32 claimId) {
        _proveLoss();
        vm.prank(holder);
        claimId = claims.fileClaim(policyId, amount);
        vm.prank(arbiter);
        claims.approveClaim(claimId);
    }
}
