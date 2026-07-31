// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IESGRegistry } from "../interfaces/IESGRegistry.sol";

/// @title ESGRegistry
/// @notice On-chain registry of ESG scores/attestations keyed by an arbitrary `subject`
///         (typically a batch id or org id). Scores are basis points (0–10000).
/// @dev Only holders of {Roles.AGENT_ROLE} — the verification/attestation agent(s) — may write
///      scores. Each write overwrites the previous record and re-emits, so the latest attestation
///      is always authoritative while indexers reconstruct history from the event log.
contract ESGRegistry is ProofChainAccess, IESGRegistry {
    /// @dev Maximum valid score in basis points (100.00%).
    uint16 private constant MAX_SCORE = 10_000;

    /// @dev subject => latest ESG record.
    mapping(bytes32 => EsgRecord) private _records;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial AGENT_ROLE (attestor).
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.AGENT_ROLE, admin);
    }

    /// @inheritdoc IESGRegistry
    function setEsg(bytes32 subject, uint16 score, string calldata uri)
        external
        override
        onlyRole(Roles.AGENT_ROLE)
    {
        _requireNotGloballyPaused();
        if (score > MAX_SCORE) revert InvalidScore(score);
        if (bytes(uri).length == 0) revert EmptyURI();

        _records[subject] = EsgRecord({
            subject: subject,
            score: score,
            uri: uri,
            updatedAt: uint64(block.timestamp),
            attestor: msg.sender,
            exists: true
        });

        emit EsgSet(subject, score, uri, msg.sender);
    }

    /// @inheritdoc IESGRegistry
    function esgOf(bytes32 subject) external view override returns (EsgRecord memory) {
        return _records[subject];
    }

    /// @inheritdoc IESGRegistry
    function scoreOf(bytes32 subject) external view override returns (uint16) {
        return _records[subject].score;
    }
}
