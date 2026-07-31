// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/// @title ICarbonCreditToken
/// @notice ERC1155 tokenized carbon offsets keyed by project id (== token id).
/// @dev deps (AddressBook): SustainabilityOracle.
interface ICarbonCreditToken is IERC1155 {
    event Retired(address indexed account, uint256 indexed projectId, uint256 amount);

    error ZeroAmount();
    error InsufficientCredits(uint256 projectId, uint256 requested, uint256 available);

    /// @notice Mint carbon credits for a project. MINTER_ROLE only.
    function mint(address to, uint256 projectId, uint256 amount) external;

    /// @notice Permanently retire credits held by the caller.
    function retire(uint256 projectId, uint256 amount) external;

    /// @notice Total credits retired for a project.
    function retiredOf(uint256 projectId) external view returns (uint256);
}
