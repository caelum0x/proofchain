// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { IPauser } from "../interfaces/IPauser.sol";
import { Roles } from "./Roles.sol";

/// @title Pauser
/// @notice Single global pause guardian other modules consult via {IPauser.requireNotPaused}.
/// @dev Guardians hold `PAUSER_ROLE`. This is a circuit breaker for protocol-wide incidents;
///      individual modules may additionally implement their own local pausing.
contract Pauser is AccessControl, IPauser {
    bool private _paused;

    error ZeroAddress();

    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial PAUSER_ROLE.
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.PAUSER_ROLE, admin);
    }

    /// @inheritdoc IPauser
    function pause() external onlyRole(Roles.PAUSER_ROLE) {
        if (_paused) revert ExpectedPause();
        _paused = true;
        emit Paused(msg.sender);
    }

    /// @inheritdoc IPauser
    function unpause() external onlyRole(Roles.PAUSER_ROLE) {
        if (!_paused) revert EnforcedPause();
        _paused = false;
        emit Unpaused(msg.sender);
    }

    /// @inheritdoc IPauser
    function paused() external view returns (bool) {
        return _paused;
    }

    /// @inheritdoc IPauser
    function requireNotPaused() external view {
        if (_paused) revert EnforcedPause();
    }
}
