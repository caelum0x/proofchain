// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IReceivableRegistry
/// @notice Tracks receivable terms (face value, due date, obligor) per batch.
interface IReceivableRegistry {
    struct Terms {
        bytes32 batchId;
        uint256 faceValue;
        uint64 dueDate;
        address obligor;
        address token;
        bool exists;
    }

    event ReceivableRegistered(
        bytes32 indexed batchId, uint256 faceValue, uint64 dueDate, address indexed obligor, address token
    );

    error ReceivableExists(bytes32 batchId);
    error UnknownReceivable(bytes32 batchId);
    error ZeroAmount();
    error ZeroAddress();
    error InvalidDueDate();

    function register(bytes32 batchId, uint256 faceValue, uint64 dueDate, address obligor, address token) external;
    function termsOf(bytes32 batchId) external view returns (Terms memory);
    function exists(bytes32 batchId) external view returns (bool);
}
