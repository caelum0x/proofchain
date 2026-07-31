// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IProofChainTimelock
/// @notice Minimal surface of the OZ TimelockController that executes passed proposals.
/// @dev Implementations inherit OZ `TimelockController`.
interface IProofChainTimelock {
    function getMinDelay() external view returns (uint256);
    function isOperation(bytes32 id) external view returns (bool);
    function isOperationReady(bytes32 id) external view returns (bool);
    function isOperationDone(bytes32 id) external view returns (bool);
}
