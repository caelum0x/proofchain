// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { ITreasury } from "../interfaces/ITreasury.sol";
import { Roles } from "../core/Roles.sol";

/// @title Treasury
/// @notice Holds protocol fees. Anyone (typically the FeeManager) may deposit; only
///         TREASURER_ROLE may withdraw.
/// @dev Tracks a per-token internal balance derived from ACTUAL received amounts (snapshot
///      deltas) so fee-on-transfer tokens can never over-report treasury holdings. All fund
///      movement is `nonReentrant` and routed through SafeERC20.
contract Treasury is ProofChainAccess, ReentrancyGuard, ITreasury {
    using SafeERC20 for IERC20;

    mapping(address => uint256) private _balances;

    /// @param addressBook_ Deployed AddressBook.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial TREASURER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.TREASURER_ROLE, admin);
    }

    /// @inheritdoc ITreasury
    function deposit(address token, uint256 amount) external override nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ITreasury.ZeroAmount();

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        _balances[token] += received;
        emit Deposit(msg.sender, token, received);
    }

    /// @inheritdoc ITreasury
    function withdraw(address token, address to, uint256 amount)
        external
        override
        nonReentrant
        onlyRole(Roles.TREASURER_ROLE)
    {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ITreasury.ZeroAmount();

        uint256 available = _balances[token];
        if (amount > available) revert InsufficientBalance(token, amount, available);

        _balances[token] = available - amount;
        IERC20(token).safeTransfer(to, amount);
        emit Withdraw(to, token, amount);
    }

    /// @inheritdoc ITreasury
    function balanceOf(address token) external view override returns (uint256) {
        return _balances[token];
    }
}
