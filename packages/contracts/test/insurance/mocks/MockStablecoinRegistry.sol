// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IStablecoinRegistry } from "../../../src/interfaces/IStablecoinRegistry.sol";

/// @notice Minimal StablecoinRegistry used only by the insurance test-suite.
contract MockStablecoinRegistry is IStablecoinRegistry {
    error ZeroAddress();

    mapping(address => TokenInfo) private _info;
    address[] private _tokens;

    function addToken(address token, uint8 decimals) external {
        if (token == address(0)) revert ZeroAddress();
        if (_info[token].accepted) revert TokenAlreadyAdded(token);
        _info[token] = TokenInfo({ token: token, decimals: decimals, accepted: true });
        _tokens.push(token);
        emit TokenAdded(token, decimals);
    }

    function removeToken(address token) external {
        if (!_info[token].accepted) revert TokenNotAccepted(token);
        _info[token].accepted = false;
        emit TokenRemoved(token);
    }

    function isAccepted(address token) external view returns (bool) {
        return _info[token].accepted;
    }

    function decimalsOf(address token) external view returns (uint8) {
        return _info[token].decimals;
    }

    function tokens() external view returns (address[] memory) {
        return _tokens;
    }
}
