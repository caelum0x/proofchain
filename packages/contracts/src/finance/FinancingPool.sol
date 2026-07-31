// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IFinancingPool } from "../interfaces/IFinancingPool.sol";
import { IInvoiceFinancing } from "../interfaces/IInvoiceFinancing.sol";
import { ILenderVault } from "../interfaces/ILenderVault.sol";
import { IScoreOracle } from "../interfaces/IScoreOracle.sol";

/// @dev The pool-only liquidity hook the {LenderVault} exposes beyond the ERC4626 surface.
interface IVaultLend {
    function lendTo(address to, uint256 amount) external;
}

/// @title FinancingPool
/// @notice Pooled lender capital that auto-funds eligible listed receivables by risk grade. Deposits
///         are tokenized as {LenderVault} (ERC4626) shares; a POOL_MANAGER allocates idle capital to
///         fund receivables graded at or better than {maxGrade}.
/// @dev Idle capital lives in the vault. {allocate} borrows exactly the ask amount from the vault
///      (share supply untouched — value is tracked via {deployedAssets}), funds the receivable
///      through {InvoiceFinancing}, and records the outstanding principal. {reconcile} sweeps the
///      repaid proceeds back into the vault after a claim, so any yield lifts every share's NAV.
contract FinancingPool is ProofChainAccess, ReentrancyGuard, IFinancingPool {
    using SafeERC20 for IERC20;

    /// @notice Outstanding advanced principal per batch (0 when none/settled).
    mapping(bytes32 => uint256) public allocatedPrincipal;

    uint256 private _deployed;
    uint8 private _maxGrade;

    event Reconciled(bytes32 indexed batchId, uint256 principal, uint256 returned);

    error NotListed(bytes32 batchId);
    error NotClaimed(bytes32 batchId);
    error NothingAllocated(bytes32 batchId);
    error AssetMismatch(bytes32 batchId);
    error AlreadyAllocated(bytes32 batchId);
    error Unauthorized();

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin DEFAULT_ADMIN_ROLE + initial POOL_MANAGER_ROLE holder.
    /// @param initialMaxGrade Worst risk grade the pool will fund (1 best .. 7 worst).
    constructor(address addressBook_, address admin, uint8 initialMaxGrade)
        ProofChainAccess(addressBook_, admin)
    {
        _grantRole(Roles.POOL_MANAGER_ROLE, admin);
        _maxGrade = initialMaxGrade;
    }

    // --------------------------------------------------------------------- liquidity

    /// @inheritdoc IFinancingPool
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        ILenderVault vault = _vault();
        IERC20 token = IERC20(vault.asset());

        token.safeTransferFrom(msg.sender, address(this), assets);
        token.forceApprove(address(vault), assets);
        shares = vault.deposit(assets, msg.sender);

        emit Deposited(msg.sender, assets, shares);
    }

    /// @inheritdoc IFinancingPool
    /// @dev Redeems the caller's vault shares. The caller must have approved this pool to spend the
    ///      shares. Reverts {InsufficientLiquidity} if idle vault liquidity cannot cover the exit.
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        ILenderVault vault = _vault();

        uint256 owed = vault.convertToAssets(shares);
        uint256 available = IERC20(vault.asset()).balanceOf(address(vault));
        if (owed > available) revert InsufficientLiquidity(owed, available);

        assets = vault.redeem(shares, msg.sender, msg.sender);
        emit Withdrawn(msg.sender, assets, shares);
    }

    // --------------------------------------------------------------------- allocation

    /// @inheritdoc IFinancingPool
    function allocate(bytes32 batchId) external nonReentrant onlyRole(Roles.POOL_MANAGER_ROLE) {
        if (allocatedPrincipal[batchId] != 0) revert AlreadyAllocated(batchId);

        IInvoiceFinancing financing = _financing();
        IInvoiceFinancing.Listing memory listing = financing.listingOf(batchId);
        if (listing.state != IInvoiceFinancing.ListingState.Listed) revert NotListed(batchId);

        ILenderVault vault = _vault();
        if (listing.token != vault.asset()) revert AssetMismatch(batchId);

        uint8 grade = IScoreOracle(_addr(Keys.SCORE_ORACLE)).gradeOf(listing.supplier);
        if (grade == 0 || grade > _maxGrade) revert IneligibleGrade(batchId, grade);

        uint256 amount = listing.askAmount;
        IERC20 token = IERC20(listing.token);
        uint256 available = token.balanceOf(address(vault));
        if (amount > available) revert InsufficientLiquidity(amount, available);

        // Borrow the advance from the vault, then fund the receivable atomically. Any failure in
        // funding reverts the whole transaction, returning the borrowed capital to the vault.
        IVaultLend(address(vault)).lendTo(address(this), amount);
        token.forceApprove(address(financing), amount);
        financing.fund(batchId);

        allocatedPrincipal[batchId] = amount;
        _deployed += amount;

        emit Allocated(batchId, amount);
    }

    /// @notice Sweep a claimed receivable's repaid proceeds back into the vault and clear the
    ///         outstanding principal. Callable by the {RepaymentController}, a POOL_MANAGER, or a
    ///         KEEPER. Yield (proceeds above principal) accrues to the vault, lifting share NAV.
    function reconcile(bytes32 batchId) external nonReentrant {
        if (
            msg.sender != _addrOrZero(Keys.REPAYMENT_CONTROLLER) && !hasRole(Roles.POOL_MANAGER_ROLE, msg.sender)
                && !hasRole(Roles.KEEPER_ROLE, msg.sender)
        ) {
            revert Unauthorized();
        }

        uint256 principal = allocatedPrincipal[batchId];
        if (principal == 0) revert NothingAllocated(batchId);

        IInvoiceFinancing.Listing memory listing = _financing().listingOf(batchId);
        if (listing.state != IInvoiceFinancing.ListingState.Claimed) revert NotClaimed(batchId);

        ILenderVault vault = _vault();
        IERC20 token = IERC20(vault.asset());
        uint256 returned = token.balanceOf(address(this));

        // Effects before interactions.
        allocatedPrincipal[batchId] = 0;
        _deployed -= principal;

        if (returned > 0) token.safeTransfer(address(vault), returned);
        emit Reconciled(batchId, principal, returned);
    }

    // --------------------------------------------------------------------- admin/views

    /// @notice Set the worst risk grade the pool will fund. POOL_MANAGER only.
    function setMaxGrade(uint8 newMaxGrade) external onlyRole(Roles.POOL_MANAGER_ROLE) {
        _maxGrade = newMaxGrade;
        emit MaxGradeUpdated(newMaxGrade);
    }

    /// @notice Total principal currently deployed into live receivables.
    function deployedAssets() external view returns (uint256) {
        return _deployed;
    }

    /// @inheritdoc IFinancingPool
    function totalLiquidity() external view returns (uint256) {
        ILenderVault vault = _vault();
        return IERC20(vault.asset()).balanceOf(address(vault));
    }

    /// @inheritdoc IFinancingPool
    function maxGrade() external view returns (uint8) {
        return _maxGrade;
    }

    function _vault() internal view returns (ILenderVault) {
        return ILenderVault(_addr(Keys.LENDER_VAULT));
    }

    function _financing() internal view returns (IInvoiceFinancing) {
        return IInvoiceFinancing(_addr(Keys.INVOICE_FINANCING));
    }
}
