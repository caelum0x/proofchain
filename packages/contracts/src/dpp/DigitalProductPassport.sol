// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IDigitalProductPassport } from "../interfaces/IDigitalProductPassport.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title DigitalProductPassport
/// @notice EU Digital Product Passport (ESPR 2027) implemented as an ERC721. Each token is a
///         product's passport, minted to its manufacturer and permanently bound to a provenance
///         batch and a GTIN. The passport is the canonical anchor the rest of the DPP module
///         (lifecycle, materials, repairability, recycling, data-carrier, compliance) attaches to.
/// @dev Resolves the {ProvenanceRegistry} through the {AddressBook} (never hardcoded). Passports
///      may only be issued for batches that already exist in the ground-truth registry, keeping the
///      passport anchored to a real, registered product batch. At most one passport per batch.
contract DigitalProductPassport is ProofChainAccess, ERC721, IDigitalProductPassport {
    /// @dev tokenId => passport record.
    mapping(uint256 => Passport) private _passports;

    /// @dev batchId => passport tokenId (0 when no passport has been issued for the batch).
    mapping(bytes32 => uint256) private _passportOfBatch;

    /// @dev Monotonic token id counter; ids start at 1 so 0 is an unambiguous "none" sentinel.
    uint256 private _nextId;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the ProvenanceRegistry.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial MINTER_ROLE.
    constructor(address addressBook_, address admin)
        ProofChainAccess(addressBook_, admin)
        ERC721("ProofChain Digital Product Passport", "DPP")
    {
        _grantRole(Roles.MINTER_ROLE, admin);
        _nextId = 1;
    }

    /// @inheritdoc IDigitalProductPassport
    function issue(bytes32 batchId, bytes32 gtin, address manufacturer, string calldata dataURI)
        external
        override
        onlyRole(Roles.MINTER_ROLE)
        returns (uint256 tokenId)
    {
        _requireNotGloballyPaused();
        if (batchId == bytes32(0)) revert ZeroBatch();
        if (manufacturer == address(0)) revert ZeroAddress();
        if (_passportOfBatch[batchId] != 0) revert PassportForBatchExists(batchId);

        // A passport can only exist for a batch that is registered in the ground-truth registry.
        IProvenanceRegistry registry = IProvenanceRegistry(_addr(Keys.PROVENANCE_REGISTRY));
        if (!registry.batchExists(batchId)) revert IProvenanceRegistry.UnknownBatch(batchId);

        tokenId = _nextId++;
        _passports[tokenId] = Passport({
            tokenId: tokenId,
            batchId: batchId,
            gtin: gtin,
            manufacturer: manufacturer,
            dataURI: dataURI,
            status: PassportStatus.Active,
            issuedAt: uint64(block.timestamp)
        });
        _passportOfBatch[batchId] = tokenId;

        _safeMint(manufacturer, tokenId);

        emit PassportIssued(tokenId, batchId, manufacturer, gtin);
        emit StatusChanged(tokenId, PassportStatus.Active);
    }

    /// @inheritdoc IDigitalProductPassport
    function setDataURI(uint256 tokenId, string calldata dataURI) external override {
        _requireNotGloballyPaused();
        Passport storage p = _requireManufacturerOrMinter(tokenId);
        p.dataURI = dataURI;
        emit DataURIUpdated(tokenId, dataURI);
    }

    /// @inheritdoc IDigitalProductPassport
    function setStatus(uint256 tokenId, PassportStatus status) external override {
        _requireNotGloballyPaused();
        Passport storage p = _requireManufacturerOrMinter(tokenId);
        if (!_validTransition(p.status, status)) {
            revert InvalidStatusTransition(tokenId, p.status, status);
        }
        p.status = status;
        emit StatusChanged(tokenId, status);
    }

    /// @inheritdoc IDigitalProductPassport
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, IDigitalProductPassport)
        returns (string memory)
    {
        _requireOwned(tokenId);
        return _passports[tokenId].dataURI;
    }

    /// @inheritdoc IDigitalProductPassport
    function passportOfBatch(bytes32 batchId) external view override returns (uint256) {
        return _passportOfBatch[batchId];
    }

    /// @inheritdoc IDigitalProductPassport
    function passportOf(uint256 tokenId) external view override returns (Passport memory) {
        return _passports[tokenId];
    }

    /// @dev Resolve the ERC165/AccessControl multiple-inheritance ambiguity.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl, IERC165)
        returns (bool)
    {
        return ERC721.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }

    /// @dev Load a known passport and enforce that the caller is its manufacturer or a MINTER.
    function _requireManufacturerOrMinter(uint256 tokenId) private view returns (Passport storage p) {
        p = _passports[tokenId];
        if (p.status == PassportStatus.None) revert UnknownPassport(tokenId);
        if (msg.sender != p.manufacturer && !hasRole(Roles.MINTER_ROLE, msg.sender)) {
            revert NotManufacturer(tokenId);
        }
    }

    /// @dev Lifecycle status machine. `Retired` is terminal; `None` is never a valid target.
    ///      Active/Suspended/Recalled may move between each other and into Retired; a Recalled or
    ///      Suspended passport may be reactivated once the issue is resolved.
    function _validTransition(PassportStatus from, PassportStatus to) private pure returns (bool) {
        if (to == PassportStatus.None) return false;
        if (from == to) return false;
        if (from == PassportStatus.Retired) return false; // terminal
        if (to == PassportStatus.Retired) return true; // any active state can retire
        // Remaining moves are between Active / Suspended / Recalled.
        return true;
    }
}
