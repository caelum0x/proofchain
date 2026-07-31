// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice Test-network USDC stand-in: ERC20 with 6 decimals and an open faucet `mint`.
/// @dev NOT for mainnet. `mint` is intentionally permissionless for test faucets.
contract MockUSDC is ERC20 {
    uint8 private constant DECIMALS = 6;

    error ZeroAddress();
    error ZeroAmount();

    constructor() ERC20("Mock USDC", "mUSDC") { }

    /// @inheritdoc ERC20
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Faucet mint for test networks.
    function mint(address to, uint256 amount) external {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
    }
}
