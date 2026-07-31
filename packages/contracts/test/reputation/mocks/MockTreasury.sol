// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ITreasury } from "../../../src/interfaces/ITreasury.sol";

/// @notice Minimal {ITreasury} for reputation-module tests. Reports live token balances so it
///         reflects funds that arrive either via `deposit` or via a direct transfer (e.g. slashing
///         proceeds routed straight to the treasury address).
contract MockTreasury is ITreasury {
    using SafeERC20 for IERC20;

    error ZeroAddress();

    function deposit(address token, uint256 amount) external override {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, token, amount);
    }

    function withdraw(address token, address to, uint256 amount) external override {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (amount > bal) revert InsufficientBalance(token, amount, bal);
        IERC20(token).safeTransfer(to, amount);
        emit Withdraw(to, token, amount);
    }

    function balanceOf(address token) external view override returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
