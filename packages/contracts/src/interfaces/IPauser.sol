// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IPauser
/// @notice Global pause guardian other modules consult before performing sensitive actions.
interface IPauser {
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    error EnforcedPause();
    error ExpectedPause();

    /// @notice Engage the global pause. PAUSER_ROLE only.
    function pause() external;

    /// @notice Release the global pause. PAUSER_ROLE only.
    function unpause() external;

    /// @notice Whether the protocol is globally paused.
    function paused() external view returns (bool);

    /// @notice Reverts `EnforcedPause` when the protocol is globally paused.
    function requireNotPaused() external view;
}
