// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal read interface of AttestationRegistry consumed by SettlementEscrow.
interface IAttestationRegistry {
    function isAttested(bytes32 batchId) external view returns (bool);
    function scoreOf(bytes32 batchId) external view returns (uint16);
}
