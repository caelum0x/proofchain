// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IFinancingPool
/// @notice Pooled lender capital that auto-funds eligible receivables by risk grade.
/// @dev deps (AddressBook): ScoreOracle, InvoiceFinancing, LenderVault, DiscountCalculator.
interface IFinancingPool {
    event Deposited(address indexed lender, uint256 assets, uint256 shares);
    event Withdrawn(address indexed lender, uint256 assets, uint256 shares);
    event Allocated(bytes32 indexed batchId, uint256 amount);
    event MaxGradeUpdated(uint8 maxGrade);

    error ZeroAmount();
    error IneligibleGrade(bytes32 batchId, uint8 grade);
    error InsufficientLiquidity(uint256 requested, uint256 available);

    /// @notice Deposit assets into the pool, receiving vault shares.
    function deposit(uint256 assets) external returns (uint256 shares);

    /// @notice Redeem `shares` for underlying assets.
    function withdraw(uint256 shares) external returns (uint256 assets);

    /// @notice Allocate pool capital to fund an eligible listed receivable. POOL_MANAGER_ROLE.
    function allocate(bytes32 batchId) external;

    function totalLiquidity() external view returns (uint256);
    function maxGrade() external view returns (uint8);
}
