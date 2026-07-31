// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IMaterialComposition
/// @notice Bill-of-materials for a Digital Product Passport: the weighted breakdown of materials, their
///         recycled content, and any substances of concern (SVHC/REACH). Fractions are in basis points and
///         must sum to 100% when the composition is sealed, enabling recyclability/DPP compliance checks.
/// @dev deps (AddressBook): DigitalProductPassport.
interface IMaterialComposition {
    struct Material {
        bytes32 materialCode;
        uint16 fractionBps;
        uint16 recycledContentBps;
        bool hazardous;
    }

    event MaterialAdded(uint256 indexed tokenId, bytes32 indexed materialCode, uint16 fractionBps, uint16 recycledContentBps, bool hazardous);
    event CompositionSealed(uint256 indexed tokenId, uint16 totalRecycledContentBps);
    event CompositionCleared(uint256 indexed tokenId);

    error UnknownPassport(uint256 tokenId);
    error AlreadySealed(uint256 tokenId);
    error NotSealed(uint256 tokenId);
    error NotAuthorized(uint256 tokenId);
    error FractionOverflow(uint16 total);
    error FractionNotHundred(uint16 total);
    error ZeroFraction();

    /// @notice Add a material line to a passport's (unsealed) composition. MINTER_ROLE or manufacturer.
    function addMaterial(uint256 tokenId, bytes32 materialCode, uint16 fractionBps, uint16 recycledContentBps, bool hazardous)
        external;

    /// @notice Seal the composition once fractions sum to 100% (10000 bps).
    function seal(uint256 tokenId) external;

    /// @notice Clear an unsealed composition to re-enter materials.
    function clear(uint256 tokenId) external;

    /// @notice The material lines recorded for a passport.
    function materialsOf(uint256 tokenId) external view returns (Material[] memory);

    /// @notice Weighted recycled content (bps) across all materials; valid once sealed.
    function recycledContentOf(uint256 tokenId) external view returns (uint16);

    /// @notice True if any material line is flagged hazardous.
    function hasHazardous(uint256 tokenId) external view returns (bool);
}
