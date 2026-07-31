// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IKYCRegistry } from "../../../src/interfaces/IKYCRegistry.sol";

/// @notice Minimal in-memory {IKYCRegistry} for ScoreOracle tests.
contract MockKYCRegistry is IKYCRegistry {
    mapping(address => KycStatus) private _status;

    function setKyc(address account, KycLevel level) external override {
        if (account == address(0)) revert ZeroAddress();
        _status[account] = KycStatus({ level: level, updatedAt: uint64(block.timestamp), provider: msg.sender });
        emit KycSet(account, level, msg.sender);
    }

    function revokeKyc(address account) external override {
        _status[account] = KycStatus({ level: KycLevel.None, updatedAt: uint64(block.timestamp), provider: msg.sender });
        emit KycRevoked(account, msg.sender);
    }

    function kycOf(address account) external view override returns (KycStatus memory) {
        return _status[account];
    }

    function levelOf(address account) external view override returns (KycLevel) {
        return _status[account].level;
    }

    function isVerified(address account) external view override returns (bool) {
        return _status[account].level >= KycLevel.Verified;
    }
}
