// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ITrancheToken
/// @notice ERC20 share of a single securitization tranche. Minted to investors when they buy in and
///         burned on redemption. Mint/burn are restricted to MINTER_ROLE (the securitization contract).
/// @dev deps (AddressBook): ReceivableSecuritization. Metadata (poolId, seniority) is immutable per token.
interface ITrancheToken is IERC20 {
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    error ZeroAmount();
    error InsufficientBalance(address account, uint256 requested, uint256 available);

    /// @notice Pool this tranche token belongs to.
    function poolId() external view returns (bytes32);

    /// @notice Seniority rank of this tranche (0 = most senior).
    function seniority() external view returns (uint16);

    /// @notice Mint tranche shares to an investor. MINTER_ROLE only.
    function mint(address to, uint256 amount) external;

    /// @notice Burn tranche shares on redemption. MINTER_ROLE only.
    function burn(address from, uint256 amount) external;
}
