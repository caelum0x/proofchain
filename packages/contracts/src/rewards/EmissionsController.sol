// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IEmissionsController } from "../interfaces/IEmissionsController.sol";

/// @title EmissionsController
/// @notice Governance-controlled source of truth for the protocol's reward emission rate.
/// @dev Reward venues (e.g. {StakingRewards}) resolve this contract via the AddressBook and read
///      {currentRate} (tokens emitted per second). Every rate change opens a new epoch so indexers
///      and downstream venues can snapshot cleanly. Only `GOVERNOR_ROLE` (the timelock) may retune
///      emissions, keeping monetary policy under governance control.
contract EmissionsController is ProofChainAccess, IEmissionsController {
    /// @notice Hard ceiling on the per-second emission rate, a guardrail against fat-finger inflation.
    /// @dev 1e24 wei/sec (~1M 18-decimal tokens per second) is far above any sane schedule while
    ///      still bounding the value so callers can trust it fits arithmetic downstream.
    uint256 public constant MAX_EMISSION_RATE = 1e24;

    uint256 private _rate;
    uint256 private _epoch;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    /// @param governor Address granted GOVERNOR_ROLE (the governance timelock) able to tune emissions.
    constructor(address addressBook_, address admin, address governor) ProofChainAccess(addressBook_, admin) {
        if (governor == address(0)) revert ZeroAddress();
        _grantRole(Roles.GOVERNOR_ROLE, governor);
    }

    /// @inheritdoc IEmissionsController
    function setEmissionRate(uint256 rate) external onlyRole(Roles.GOVERNOR_ROLE) {
        if (rate > MAX_EMISSION_RATE) revert InvalidRate(rate);
        _rate = rate;
        uint256 epoch = _epoch + 1;
        _epoch = epoch;
        emit EmissionRateSet(epoch, rate);
    }

    /// @inheritdoc IEmissionsController
    function currentRate() external view returns (uint256) {
        return _rate;
    }

    /// @inheritdoc IEmissionsController
    function currentEpoch() external view returns (uint256) {
        return _epoch;
    }
}
