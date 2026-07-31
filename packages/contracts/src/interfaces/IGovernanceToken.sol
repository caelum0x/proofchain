// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVotes } from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/// @title IGovernanceToken
/// @notice PROOF ERC20Votes governance token with a role-gated mint.
interface IGovernanceToken is IERC20, IVotes {
    event Minted(address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();

    /// @notice Mint governance tokens. MINTER_ROLE only.
    function mint(address to, uint256 amount) external;
}
