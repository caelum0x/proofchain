// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { LenderVault } from "../../../src/finance/LenderVault.sol";

/// @notice Stand-in for the FinancingPool used by {LenderVault} tests. Reports a settable deployed
///         balance and can trigger the vault's pool-only {lendTo}.
contract MockDeployedPool {
    uint256 public deployed;

    function setDeployed(uint256 v) external {
        deployed = v;
    }

    function deployedAssets() external view returns (uint256) {
        return deployed;
    }

    function doLend(address vault, address to, uint256 amount) external {
        LenderVault(vault).lendTo(to, amount);
        deployed += amount;
    }
}
