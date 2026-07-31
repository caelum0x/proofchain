// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { ICommodityToken } from "../interfaces/ICommodityToken.sol";

/// @title CommodityToken
/// @notice ERC20 representing one fungible, graded commodity (e.g. 1 token == 1kg of ARABICA-A coffee).
///         Supply is minted only by the {CommodityVault} against a settled {StorageReceipt} and burned on
///         physical redemption, so the circulating supply stays fully backed by warehoused inventory.
/// @dev Minting/burning is gated on the caller being the {CommodityVault} registered in the {AddressBook};
///      no free-standing MINTER_ROLE grant is required, keeping the 1:1 backing invariant enforced by a
///      single trusted peer. `commodityCode` and `grade` are immutable so the token can never represent a
///      different asset class than it was deployed for.
contract CommodityToken is ProofChainAccess, ERC20, ICommodityToken {
    /// @inheritdoc ICommodityToken
    bytes32 public immutable commodityCode;

    /// @inheritdoc ICommodityToken
    bytes32 public immutable grade;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    /// @param name_ ERC20 token name.
    /// @param symbol_ ERC20 token symbol.
    /// @param commodityCode_ Commodity symbol code (e.g. keccak256("ARABICA-A")).
    /// @param grade_ Grade class this token is fungible within.
    constructor(
        address addressBook_,
        address admin,
        string memory name_,
        string memory symbol_,
        bytes32 commodityCode_,
        bytes32 grade_
    ) ProofChainAccess(addressBook_, admin) ERC20(name_, symbol_) {
        commodityCode = commodityCode_;
        grade = grade_;
    }

    /// @dev Revert unless the caller is the {CommodityVault} registered in the {AddressBook}.
    function _onlyVault() private view {
        if (msg.sender != _addr(Keys.COMMODITY_VAULT)) revert NotVault(msg.sender);
    }

    /// @inheritdoc ICommodityToken
    function mint(address to, uint256 amount, bytes32 receiptId) external override {
        _onlyVault();
        _requireNotGloballyPaused();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _mint(to, amount);
        emit Minted(to, amount, receiptId);
    }

    /// @inheritdoc ICommodityToken
    function burn(address from, uint256 amount, bytes32 receiptId) external override {
        _onlyVault();
        _requireNotGloballyPaused();
        if (amount == 0) revert ZeroAmount();

        uint256 balance = balanceOf(from);
        if (balance < amount) revert InsufficientBalance(from, amount, balance);

        _burn(from, amount);
        emit Burned(from, amount, receiptId);
    }

    /// @dev Resolve the ERC165/AccessControl inheritance (ERC20 has no ERC165 surface of its own).
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return AccessControl.supportsInterface(interfaceId);
    }
}
