// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";

/// @dev Minimal view the vault needs from the {FinancingPool} to value deployed capital.
interface IDeployedCapital {
    function deployedAssets() external view returns (uint256);
}

/// @title LenderVault
/// @notice ERC4626 tokenized shares of the lending pool's capital. Depositors receive vault
///         shares (`pcLV`) redeemable pro-rata for the underlying stablecoin.
/// @dev Satisfies the {ILenderVault} surface via OpenZeppelin {ERC4626}; it is not declared
///      `is ILenderVault` because {IERC4626} and {ILenderVault} both declare `Deposit`/`Withdraw`
///      events, which Solidity forbids duplicating. `totalAssets` is overridden to count BOTH idle
///      stablecoin held here AND capital the {FinancingPool} has deployed into live receivables, so
///      share price reflects outstanding loans. Idle liquidity can be lent out to the pool via
///      {lendTo} (pool-only) without minting/burning shares — NAV is preserved because the moved
///      assets are accounted for in `deployedAssets`.
contract LenderVault is ERC4626, ProofChainAccess, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Emitted when idle capital is advanced to the pool to fund a receivable.
    event LentToPool(address indexed pool, uint256 amount);

    error NotPool();
    error ZeroAmount();

    constructor(address addressBook_, address admin, address asset_)
        ERC20("ProofChain Lender Vault", "pcLV")
        ERC4626(IERC20(asset_))
        ProofChainAccess(addressBook_, admin)
    {
        if (asset_ == address(0)) revert ZeroAddress();
    }

    /// @inheritdoc ERC4626
    /// @dev Total assets = idle stablecoin in the vault + capital deployed by the pool.
    function totalAssets() public view override returns (uint256) {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        address pool = _addrOrZero(Keys.FINANCING_POOL);
        uint256 deployed = pool == address(0) ? 0 : IDeployedCapital(pool).deployedAssets();
        return idle + deployed;
    }

    /// @notice Advance idle liquidity to the {FinancingPool} so it can fund a receivable.
    /// @dev Pool-only. Does not touch shares; the moved amount is reflected in `deployedAssets` so
    ///      `totalAssets` (and therefore share price) is unchanged by the transfer itself.
    function lendTo(address to, uint256 amount) external nonReentrant {
        if (msg.sender != _addr(Keys.FINANCING_POOL)) revert NotPool();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(asset()).safeTransfer(to, amount);
        emit LentToPool(to, amount);
    }
}
