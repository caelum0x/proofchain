// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IAMLRegistry } from "../interfaces/IAMLRegistry.sol";
import { ISanctionsScreening } from "../interfaces/ISanctionsScreening.sol";

/// @title AMLRegistry
/// @notice Anti-money-laundering risk register. Compliance officers assign per-account risk ratings and
///         raise/resolve Suspicious Activity Reports (SARs). `isHighRisk` folds in the optional
///         {SanctionsScreening} peer so downstream finance/settlement can gate on a single signal.
/// @dev Peers resolved via the {AddressBook}. Pure registry — no funds move here.
contract AMLRegistry is ProofChainAccess, IAMLRegistry {
    /// @dev Internal SAR bookkeeping (the public struct {RiskProfile} only tracks the open count).
    struct SARRecord {
        address subject;
        bool exists;
        bool resolved;
    }

    mapping(address => RiskProfile) private _profiles;
    mapping(bytes32 => SARRecord) private _sars;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial COMPLIANCE_OFFICER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.COMPLIANCE_OFFICER_ROLE, admin);
    }

    /// @inheritdoc IAMLRegistry
    function setRisk(address account, RiskRating rating, bytes32 evidenceHash)
        external
        onlyRole(Roles.COMPLIANCE_OFFICER_ROLE)
    {
        _requireNotGloballyPaused();
        if (account == address(0)) revert ZeroAddress();
        // `Unrated` is the implicit default and cannot be explicitly assigned.
        if (rating == RiskRating.Unrated) revert InvalidRating();

        RiskProfile storage profile = _profiles[account];
        profile.rating = rating;
        profile.updatedAt = uint64(block.timestamp);
        profile.evidenceHash = evidenceHash;

        emit RiskRated(account, rating, evidenceHash);
    }

    /// @inheritdoc IAMLRegistry
    function fileSAR(bytes32 sarId, address subject, bytes32 detailsHash)
        external
        onlyRole(Roles.COMPLIANCE_OFFICER_ROLE)
    {
        _requireNotGloballyPaused();
        if (subject == address(0)) revert ZeroAddress();
        if (_sars[sarId].exists) revert SARExists(sarId);

        _sars[sarId] = SARRecord({ subject: subject, exists: true, resolved: false });
        _profiles[subject].openSARs += 1;

        emit SARFiled(sarId, subject, detailsHash);
    }

    /// @inheritdoc IAMLRegistry
    function resolveSAR(bytes32 sarId, bool escalated) external onlyRole(Roles.COMPLIANCE_OFFICER_ROLE) {
        _requireNotGloballyPaused();
        SARRecord storage sar = _sars[sarId];
        if (!sar.exists || sar.resolved) revert UnknownSAR(sarId);

        sar.resolved = true;
        RiskProfile storage profile = _profiles[sar.subject];
        if (profile.openSARs > 0) profile.openSARs -= 1;

        // An escalated SAR pins the subject to the Prohibited rating.
        if (escalated) {
            profile.rating = RiskRating.Prohibited;
            profile.updatedAt = uint64(block.timestamp);
            emit RiskRated(sar.subject, RiskRating.Prohibited, sarId);
        }

        emit SARResolved(sarId, escalated);
    }

    /// @inheritdoc IAMLRegistry
    function riskOf(address account) external view returns (RiskRating) {
        return _profiles[account].rating;
    }

    /// @inheritdoc IAMLRegistry
    function isHighRisk(address account) external view returns (bool) {
        RiskProfile storage profile = _profiles[account];
        if (profile.rating == RiskRating.High || profile.rating == RiskRating.Prohibited) return true;
        if (profile.openSARs > 0) return true;

        // Fold in the optional sanctions signal so callers only need one gate.
        address sanctions = _addrOrZero(Keys.SANCTIONS_SCREENING);
        if (sanctions != address(0) && ISanctionsScreening(sanctions).isSanctioned(account)) return true;

        return false;
    }

    /// @inheritdoc IAMLRegistry
    function profileOf(address account) external view returns (RiskProfile memory) {
        return _profiles[account];
    }
}
