// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IMaterialComposition } from "../interfaces/IMaterialComposition.sol";
import { IDigitalProductPassport } from "../interfaces/IDigitalProductPassport.sol";

/// @title MaterialComposition
/// @notice Bill-of-materials for a Digital Product Passport: the weighted breakdown of a product's
///         materials (basis points), their recycled content, and any substances of concern. The
///         composition is built up line-by-line while unsealed, then sealed once the fractions sum
///         to exactly 100% — at which point the weighted recycled content is frozen for
///         recyclability / DPP compliance checks.
/// @dev Resolves the {DigitalProductPassport} through the {AddressBook}. Only a passport's
///      manufacturer or a {Roles.MINTER_ROLE} holder may edit an unsealed composition.
contract MaterialComposition is ProofChainAccess, IMaterialComposition {
    /// @dev 100.00% expressed in basis points.
    uint16 private constant BPS_DENOMINATOR = 10_000;

    struct Composition {
        Material[] materials;
        uint16 totalFractionBps;
        uint16 recycledContentBps; // weighted, computed at seal time
        bool sealed_;
        bool hazardous;
        bool exists;
    }

    /// @dev tokenId => composition.
    mapping(uint256 => Composition) private _compositions;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the DigitalProductPassport.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial MINTER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.MINTER_ROLE, admin);
    }

    /// @inheritdoc IMaterialComposition
    function addMaterial(
        uint256 tokenId,
        bytes32 materialCode,
        uint16 fractionBps,
        uint16 recycledContentBps,
        bool hazardous
    ) external override {
        _requireNotGloballyPaused();
        _requireManufacturerOrMinter(tokenId);

        Composition storage c = _compositions[tokenId];
        if (c.sealed_) revert AlreadySealed(tokenId);
        if (fractionBps == 0) revert ZeroFraction();
        // Recycled content is itself a fraction of this material line and cannot exceed 100%.
        if (recycledContentBps > BPS_DENOMINATOR) revert FractionOverflow(recycledContentBps);

        uint16 newTotal = c.totalFractionBps + fractionBps;
        if (newTotal > BPS_DENOMINATOR) revert FractionOverflow(newTotal);

        c.exists = true;
        c.totalFractionBps = newTotal;
        if (hazardous) c.hazardous = true;
        c.materials.push(
            Material({
                materialCode: materialCode,
                fractionBps: fractionBps,
                recycledContentBps: recycledContentBps,
                hazardous: hazardous
            })
        );

        emit MaterialAdded(tokenId, materialCode, fractionBps, recycledContentBps, hazardous);
    }

    /// @inheritdoc IMaterialComposition
    function seal(uint256 tokenId) external override {
        _requireNotGloballyPaused();
        _requireManufacturerOrMinter(tokenId);

        Composition storage c = _compositions[tokenId];
        if (c.sealed_) revert AlreadySealed(tokenId);
        if (c.totalFractionBps != BPS_DENOMINATOR) revert FractionNotHundred(c.totalFractionBps);

        // Weighted recycled content across all lines: sum(fraction_i * recycled_i) / 10000.
        // With total fraction == 10000, the result is itself a value in [0, 10000] bps.
        uint256 weighted;
        uint256 len = c.materials.length;
        for (uint256 i; i < len; ++i) {
            Material storage m = c.materials[i];
            weighted += uint256(m.fractionBps) * uint256(m.recycledContentBps);
        }
        uint16 recycled = uint16(weighted / BPS_DENOMINATOR);

        c.recycledContentBps = recycled;
        c.sealed_ = true;

        emit CompositionSealed(tokenId, recycled);
    }

    /// @inheritdoc IMaterialComposition
    function clear(uint256 tokenId) external override {
        _requireNotGloballyPaused();
        _requireManufacturerOrMinter(tokenId);

        Composition storage c = _compositions[tokenId];
        if (c.sealed_) revert AlreadySealed(tokenId);

        delete c.materials;
        c.totalFractionBps = 0;
        c.recycledContentBps = 0;
        c.hazardous = false;

        emit CompositionCleared(tokenId);
    }

    /// @inheritdoc IMaterialComposition
    function materialsOf(uint256 tokenId) external view override returns (Material[] memory) {
        return _compositions[tokenId].materials;
    }

    /// @inheritdoc IMaterialComposition
    function recycledContentOf(uint256 tokenId) external view override returns (uint16) {
        Composition storage c = _compositions[tokenId];
        if (!c.sealed_) revert NotSealed(tokenId);
        return c.recycledContentBps;
    }

    /// @inheritdoc IMaterialComposition
    function hasHazardous(uint256 tokenId) external view override returns (bool) {
        return _compositions[tokenId].hazardous;
    }

    /// @dev Enforce that the passport exists and the caller is its manufacturer or a MINTER.
    function _requireManufacturerOrMinter(uint256 tokenId) private view {
        IDigitalProductPassport dpp = IDigitalProductPassport(_addr(Keys.DIGITAL_PRODUCT_PASSPORT));
        IDigitalProductPassport.Passport memory p = dpp.passportOf(tokenId);
        if (p.status == IDigitalProductPassport.PassportStatus.None) revert UnknownPassport(tokenId);
        if (msg.sender != p.manufacturer && !hasRole(Roles.MINTER_ROLE, msg.sender)) {
            revert NotAuthorized(tokenId);
        }
    }
}
