// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISanctionsScreening
/// @notice On-chain sanctions/denied-party screening. Compliance officers maintain a list of blocked
///         entities (by address and by off-chain identity hash) sourced from OFAC/EU/UN lists, with a
///         reason and list source. Other modules gate actions on `isSanctioned`.
/// @dev deps (AddressBook): none required; consumed by TradeComplianceEngine and finance modules.
interface ISanctionsScreening {
    enum ListSource {
        Unknown,
        OFAC,
        EU,
        UN,
        UK,
        Other
    }

    struct SanctionEntry {
        bool blocked;
        ListSource source;
        bytes32 reasonHash;
        uint64 addedAt;
        uint64 clearedAt;
    }

    event AddressListed(address indexed account, ListSource source, bytes32 reasonHash);
    event AddressCleared(address indexed account);
    event EntityListed(bytes32 indexed entityHash, ListSource source, bytes32 reasonHash);
    event EntityCleared(bytes32 indexed entityHash);

    error AlreadyListed();
    error NotListed();
    error ZeroEntity();

    /// @notice Block an address. COMPLIANCE_OFFICER_ROLE only.
    function listAddress(address account, ListSource source, bytes32 reasonHash) external;

    /// @notice Clear (unblock) a previously listed address.
    function clearAddress(address account) external;

    /// @notice Block an off-chain entity by identity hash (name/registration commitment).
    function listEntity(bytes32 entityHash, ListSource source, bytes32 reasonHash) external;

    /// @notice Clear a previously listed entity hash.
    function clearEntity(bytes32 entityHash) external;

    /// @notice True if `account` is currently sanctioned.
    function isSanctioned(address account) external view returns (bool);

    /// @notice True if `entityHash` is currently sanctioned.
    function isEntitySanctioned(bytes32 entityHash) external view returns (bool);

    function entryOf(address account) external view returns (SanctionEntry memory);
}
