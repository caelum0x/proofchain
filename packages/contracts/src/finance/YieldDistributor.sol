// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IYieldDistributor } from "../interfaces/IYieldDistributor.sol";

/// @title YieldDistributor
/// @notice Accrues repayment yield earmarked for a pool and distributes it into the pool's
///         {LenderVault}, lifting every share's NAV pro-rata.
/// @dev Yield is booked via {notify} (a KEEPER or the {RepaymentController} transfers the tokens in)
///      and later pushed to the vault via {distribute}. Each pool accrues a single settlement token;
///      mixing tokens for one pool id is rejected to keep accounting unambiguous.
contract YieldDistributor is ProofChainAccess, ReentrancyGuard, IYieldDistributor {
    using SafeERC20 for IERC20;

    struct Accrual {
        address token;
        uint256 amount;
    }

    mapping(bytes32 => Accrual) private _accrued;

    event YieldNotified(bytes32 indexed poolId, address indexed token, uint256 amount);

    error NotAuthorized();
    error TokenMismatch(bytes32 poolId);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.KEEPER_ROLE, admin);
    }

    /// @notice Book `amount` of `token` as yield owed to `poolId`. The caller must approve this
    ///         contract and the tokens are pulled in. KEEPER or {RepaymentController} only.
    function notify(bytes32 poolId, address token, uint256 amount) external nonReentrant {
        if (!hasRole(Roles.KEEPER_ROLE, msg.sender) && msg.sender != _addrOrZero(Keys.REPAYMENT_CONTROLLER)) {
            revert NotAuthorized();
        }
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Accrual storage acc = _accrued[poolId];
        if (acc.amount != 0 && acc.token != token) revert TokenMismatch(poolId);

        // Snapshot balance to stay correct under fee-on-transfer tokens.
        IERC20 t = IERC20(token);
        uint256 before = t.balanceOf(address(this));
        t.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = t.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();

        acc.token = token;
        acc.amount += received;

        emit YieldNotified(poolId, token, received);
    }

    /// @inheritdoc IYieldDistributor
    function distribute(bytes32 poolId) external nonReentrant {
        Accrual storage acc = _accrued[poolId];
        uint256 amount = acc.amount;
        if (amount == 0) revert NothingToDistribute(poolId);

        address token = acc.token;
        address vault = _addr(Keys.LENDER_VAULT);

        // Effects before interactions.
        acc.amount = 0;

        IERC20(token).safeTransfer(vault, amount);
        emit YieldDistributed(poolId, token, amount);
    }

    /// @inheritdoc IYieldDistributor
    function pendingYield(bytes32 poolId) external view returns (uint256) {
        return _accrued[poolId].amount;
    }

    /// @notice The settlement token currently accrued for a pool (zero address if none).
    function yieldToken(bytes32 poolId) external view returns (address) {
        return _accrued[poolId].token;
    }
}
