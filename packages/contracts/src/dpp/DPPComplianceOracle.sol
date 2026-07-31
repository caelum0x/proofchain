// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IDPPComplianceOracle } from "../interfaces/IDPPComplianceOracle.sol";
import { IDigitalProductPassport } from "../interfaces/IDigitalProductPassport.sol";

/// @title DPPComplianceOracle
/// @notice AI / attestation-driven DPP completeness and regulatory-conformance oracle. For each
///         passport it records a compliance score, the set of satisfied requirement flags, and a
///         pass/fail verdict against a named regulation profile (e.g. ESPR, EU battery regulation).
///         A profile declares the bitmask of flags it requires and the minimum score to pass.
/// @dev Resolves the {DigitalProductPassport} through the {AddressBook}. Profiles are governed by
///      {Roles.GOVERNOR_ROLE}; evaluations are written by the verification {Roles.AGENT_ROLE}. The
///      verdict is derived deterministically so it can be reconciled off-chain against the same
///      inputs.
contract DPPComplianceOracle is ProofChainAccess, IDPPComplianceOracle {
    /// @dev 100.00% expressed in basis points.
    uint16 private constant MAX_SCORE = 10_000;

    struct Profile {
        uint32 requiredFlags;
        uint16 minScore;
        bool configured;
    }

    /// @dev regulationProfile => configuration.
    mapping(bytes32 => Profile) private _profiles;

    /// @dev tokenId => regulationProfile => latest report.
    mapping(uint256 => mapping(bytes32 => ComplianceReport)) private _reports;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the DigitalProductPassport.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE plus the initial GOVERNOR_ROLE and AGENT_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.GOVERNOR_ROLE, admin);
        _grantRole(Roles.AGENT_ROLE, admin);
    }

    /// @inheritdoc IDPPComplianceOracle
    function configureProfile(bytes32 regulationProfile, uint32 requiredFlags, uint16 minScore)
        external
        override
        onlyRole(Roles.GOVERNOR_ROLE)
    {
        _requireNotGloballyPaused();
        if (regulationProfile == bytes32(0)) revert UnknownProfile(regulationProfile);
        if (minScore > MAX_SCORE) revert ScoreOutOfRange(minScore);

        _profiles[regulationProfile] = Profile({ requiredFlags: requiredFlags, minScore: minScore, configured: true });

        emit ProfileConfigured(regulationProfile, requiredFlags, minScore);
    }

    /// @inheritdoc IDPPComplianceOracle
    function evaluate(
        uint256 tokenId,
        bytes32 regulationProfile,
        uint16 score,
        uint32 satisfiedFlags,
        bytes32 evidenceHash
    ) external override onlyRole(Roles.AGENT_ROLE) returns (Verdict verdict) {
        _requireNotGloballyPaused();
        if (score > MAX_SCORE) revert ScoreOutOfRange(score);

        Profile memory profile = _profiles[regulationProfile];
        if (!profile.configured) revert UnknownProfile(regulationProfile);

        IDigitalProductPassport dpp = IDigitalProductPassport(_addr(Keys.DIGITAL_PRODUCT_PASSPORT));
        IDigitalProductPassport.Passport memory p = dpp.passportOf(tokenId);
        if (p.status == IDigitalProductPassport.PassportStatus.None) revert UnknownPassport(tokenId);

        verdict = _deriveVerdict(profile, score, satisfiedFlags);

        _reports[tokenId][regulationProfile] = ComplianceReport({
            tokenId: tokenId,
            regulationProfile: regulationProfile,
            score: score,
            satisfiedFlags: satisfiedFlags,
            requiredFlags: profile.requiredFlags,
            verdict: verdict,
            evidenceHash: evidenceHash,
            evaluatedAt: uint64(block.timestamp)
        });

        emit Evaluated(tokenId, regulationProfile, score, verdict);
    }

    /// @inheritdoc IDPPComplianceOracle
    function isCompliant(uint256 tokenId, bytes32 regulationProfile) external view override returns (bool) {
        return _reports[tokenId][regulationProfile].verdict == Verdict.Compliant;
    }

    /// @inheritdoc IDPPComplianceOracle
    function reportOf(uint256 tokenId, bytes32 regulationProfile)
        external
        view
        override
        returns (ComplianceReport memory)
    {
        return _reports[tokenId][regulationProfile];
    }

    /// @dev Deterministic verdict: all required flags satisfied and score at/above the minimum is
    ///      Compliant; all required flags satisfied but score below the minimum is Conditional;
    ///      any missing required flag is NonCompliant.
    function _deriveVerdict(Profile memory profile, uint16 score, uint32 satisfiedFlags)
        private
        pure
        returns (Verdict)
    {
        bool allFlags = (satisfiedFlags & profile.requiredFlags) == profile.requiredFlags;
        if (!allFlags) return Verdict.NonCompliant;
        return score >= profile.minScore ? Verdict.Compliant : Verdict.Conditional;
    }
}
