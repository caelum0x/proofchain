// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IGovernor } from "@openzeppelin/contracts/governance/IGovernor.sol";

/// @title IProofChainGovernor
/// @notice OpenZeppelin Governor over protocol parameters (fees, thresholds).
/// @dev Implementations inherit OZ `Governor` + extensions; this alias lets peers depend on the
///      standard governor surface without importing the concrete contract.
interface IProofChainGovernor is IGovernor { }
