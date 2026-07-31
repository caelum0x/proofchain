// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ICommodityToken
/// @notice ERC20 representing a fungible, graded commodity (e.g. one token = 1kg of a given grade of coffee).
///         Tokens are minted only against a settled storage receipt / vault deposit and burned on physical
///         redemption, keeping the on-chain supply fully backed by warehoused inventory.
/// @dev deps (AddressBook): CommodityVault, StorageReceipt, GradingRegistry, PriceOracle.
interface ICommodityToken is IERC20 {
    event Minted(address indexed to, uint256 amount, bytes32 indexed receiptId);
    event Burned(address indexed from, uint256 amount, bytes32 indexed receiptId);

    error ZeroAmount();
    error InsufficientBalance(address account, uint256 requested, uint256 available);
    error NotVault(address caller);

    /// @notice Commodity symbol code (e.g. keccak256("ARABICA-A")).
    function commodityCode() external view returns (bytes32);

    /// @notice Grade class this token is fungible within.
    function grade() external view returns (bytes32);

    /// @notice Mint tokens backed by a storage receipt. MINTER_ROLE (the vault) only.
    function mint(address to, uint256 amount, bytes32 receiptId) external;

    /// @notice Burn tokens on physical redemption. MINTER_ROLE (the vault) only.
    function burn(address from, uint256 amount, bytes32 receiptId) external;
}
