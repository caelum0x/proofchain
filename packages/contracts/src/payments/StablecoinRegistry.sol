// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title StablecoinRegistry
/// @notice Admin-curated allowlist of accepted settlement tokens and their decimals.
/// @dev Peers (PaymentRouter, bonds, pools) resolve this via the AddressBook and gate token
///      acceptance through {isAccepted}. Removal is a soft delete: the token is dropped from the
///      enumerable list and marked not-accepted, but its recorded decimals are retained.
contract StablecoinRegistry is ProofChainAccess, IStablecoinRegistry {
    mapping(address => TokenInfo) private _info;
    // 1-based index into `_tokenList` for O(1) swap-and-pop removal (0 == not present).
    mapping(address => uint256) private _indexPlusOne;
    address[] private _tokenList;

    /// @param addressBook_ Deployed AddressBook.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE (the only role that curates the allowlist).
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IStablecoinRegistry
    function addToken(address token, uint8 decimals) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        if (_info[token].accepted) revert TokenAlreadyAdded(token);

        _info[token] = TokenInfo({ token: token, decimals: decimals, accepted: true });
        _tokenList.push(token);
        _indexPlusOne[token] = _tokenList.length;

        emit TokenAdded(token, decimals);
    }

    /// @inheritdoc IStablecoinRegistry
    function removeToken(address token) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_info[token].accepted) revert TokenNotAccepted(token);

        _info[token].accepted = false;

        uint256 idx = _indexPlusOne[token] - 1;
        uint256 lastIdx = _tokenList.length - 1;
        if (idx != lastIdx) {
            address moved = _tokenList[lastIdx];
            _tokenList[idx] = moved;
            _indexPlusOne[moved] = idx + 1;
        }
        _tokenList.pop();
        _indexPlusOne[token] = 0;

        emit TokenRemoved(token);
    }

    /// @inheritdoc IStablecoinRegistry
    function isAccepted(address token) external view override returns (bool) {
        return _info[token].accepted;
    }

    /// @inheritdoc IStablecoinRegistry
    function decimalsOf(address token) external view override returns (uint8) {
        if (!_info[token].accepted) revert TokenNotAccepted(token);
        return _info[token].decimals;
    }

    /// @inheritdoc IStablecoinRegistry
    function tokens() external view override returns (address[] memory) {
        return _tokenList;
    }
}
