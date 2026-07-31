// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IColdChainMonitor } from "../interfaces/IColdChainMonitor.sol";
import { IPolicyManager } from "../interfaces/IPolicyManager.sol";
import { IClaimsProcessor } from "../interfaces/IClaimsProcessor.sol";

/// @title ColdChainMonitor
/// @notice Temperature/humidity excursion monitor for cold-chain shipments. A profile fixes the
///         allowed temperature band and humidity ceiling for a batch; keepers push signed sensor
///         readings, and any reading outside the band records a verifiable breach. The first breach
///         optionally triggers a parametric insurance claim against the batch's active policy.
/// @dev Deps resolved via the {AddressBook}: KEEPER/REGISTRAR role gate profile creation, KEEPER
///      pushes readings. The {PolicyManager} + {ClaimsProcessor} hooks are OPTIONAL and best-effort:
///      a missing policy, unwired module, or missing role degrades gracefully and never blocks a
///      keeper's reading. No funds move in this contract.
contract ColdChainMonitor is ProofChainAccess, IColdChainMonitor {
    mapping(bytes32 => Profile) private _profiles;
    mapping(bytes32 => Reading[]) private _readings;
    /// @dev Guards one-shot parametric claim filing per batch.
    mapping(bytes32 => bool) private _claimFiled;

    /// @notice Emitted (best-effort) when a breach files a parametric claim on a batch's policy.
    event ParametricClaimTriggered(bytes32 indexed batchId, bytes32 indexed policyId, uint256 coverage);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IColdChainMonitor
    function setProfile(bytes32 batchId, int256 minTemp, int256 maxTemp, uint16 maxHumidityBps) external {
        _requireNotGloballyPaused();
        _requireKeeperOrRegistrar();
        if (_profiles[batchId].active) revert ProfileExists(batchId);
        if (minTemp > maxTemp) revert InvalidBand(minTemp, maxTemp);

        Profile storage p = _profiles[batchId];
        p.batchId = batchId;
        p.minTemp = minTemp;
        p.maxTemp = maxTemp;
        p.maxHumidityBps = maxHumidityBps;
        p.active = true;
        // breachCount / breached preserved intentionally: a re-opened profile keeps its history.

        emit ProfileSet(batchId, minTemp, maxTemp, maxHumidityBps);
    }

    /// @inheritdoc IColdChainMonitor
    function pushReading(bytes32 batchId, int256 temp, uint16 humidityBps, bytes32 dataHash)
        external
        onlyRole(Roles.KEEPER_ROLE)
        returns (bool breach)
    {
        _requireNotGloballyPaused();
        Profile storage p = _profiles[batchId];
        if (p.batchId == bytes32(0)) revert UnknownProfile(batchId);
        if (!p.active) revert ProfileInactive(batchId);

        breach = temp < p.minTemp || temp > p.maxTemp || humidityBps > p.maxHumidityBps;

        uint256 index = _readings[batchId].length;
        _readings[batchId].push(
            Reading({
                temp: temp,
                humidityBps: humidityBps,
                dataHash: dataHash,
                timestamp: uint64(block.timestamp),
                breach: breach
            })
        );

        emit ReadingRecorded(batchId, index, temp, humidityBps, breach);

        if (breach) {
            bool firstBreach = !p.breached;
            p.breached = true;
            p.breachCount += 1;
            emit Breached(batchId, temp, humidityBps, p.breachCount);
            if (firstBreach) {
                _triggerParametricPayout(batchId);
            }
        }
    }

    /// @inheritdoc IColdChainMonitor
    function closeProfile(bytes32 batchId) external {
        _requireNotGloballyPaused();
        _requireKeeperOrRegistrar();
        Profile storage p = _profiles[batchId];
        if (p.batchId == bytes32(0)) revert UnknownProfile(batchId);
        if (!p.active) revert ProfileInactive(batchId);

        p.active = false;
        emit ProfileClosed(batchId);
    }

    /// @inheritdoc IColdChainMonitor
    function isBreached(bytes32 batchId) external view returns (bool) {
        return _profiles[batchId].breached;
    }

    /// @inheritdoc IColdChainMonitor
    function readingCount(bytes32 batchId) external view returns (uint256) {
        return _readings[batchId].length;
    }

    /// @inheritdoc IColdChainMonitor
    function readingAt(bytes32 batchId, uint256 index) external view returns (Reading memory) {
        return _readings[batchId][index];
    }

    /// @inheritdoc IColdChainMonitor
    function profileOf(bytes32 batchId) external view returns (Profile memory) {
        return _profiles[batchId];
    }

    // --------------------------------------------------------------------- internal

    /// @dev Accept KEEPER_ROLE or REGISTRAR_ROLE for profile lifecycle.
    function _requireKeeperOrRegistrar() private view {
        if (!hasRole(Roles.KEEPER_ROLE, msg.sender) && !hasRole(Roles.REGISTRAR_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, Roles.KEEPER_ROLE);
        }
    }

    /// @dev Best-effort parametric claim: on the first breach, look up the batch's active policy on
    ///      the optional {PolicyManager} and file a claim for its coverage on the optional
    ///      {ClaimsProcessor}. Wrapped so cold-chain telemetry is never blocked by insurance wiring.
    function _triggerParametricPayout(bytes32 batchId) private {
        if (_claimFiled[batchId]) return;
        address pmAddr = _addrOrZero(Keys.POLICY_MANAGER);
        address cpAddr = _addrOrZero(Keys.CLAIMS_PROCESSOR);
        if (pmAddr == address(0) || cpAddr == address(0)) return;

        try IPolicyManager(pmAddr).policyForBatch(batchId) returns (bytes32 policyId) {
            if (policyId == bytes32(0)) return;
            try IPolicyManager(pmAddr).policyOf(policyId) returns (IPolicyManager.Policy memory pol) {
                if (pol.state != IPolicyManager.PolicyState.Active || pol.coverage == 0) return;
                try IClaimsProcessor(cpAddr).fileClaim(policyId, pol.coverage) returns (bytes32) {
                    _claimFiled[batchId] = true;
                    emit ParametricClaimTriggered(batchId, policyId, pol.coverage);
                } catch { }
            } catch { }
        } catch { }
    }
}
