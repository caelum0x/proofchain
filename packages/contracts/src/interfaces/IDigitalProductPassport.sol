// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title IDigitalProductPassport
/// @notice EU Digital Product Passport (ESPR 2027) as an ERC721. Each token is a product's passport,
///         binding it to a provenance batch, a GS1/data-carrier link, and evolving compliance state.
///         The passport is the canonical anchor other DPP modules (lifecycle, materials, recycling) attach to.
/// @dev deps (AddressBook): ProvenanceRegistry, DPPDataCarrier, DPPComplianceOracle.
interface IDigitalProductPassport is IERC721 {
    enum PassportStatus {
        None,
        Active,
        Suspended,
        Recalled,
        Retired
    }

    struct Passport {
        uint256 tokenId;
        bytes32 batchId;
        bytes32 gtin;
        address manufacturer;
        string dataURI;
        PassportStatus status;
        uint64 issuedAt;
    }

    event PassportIssued(uint256 indexed tokenId, bytes32 indexed batchId, address indexed manufacturer, bytes32 gtin);
    event DataURIUpdated(uint256 indexed tokenId, string dataURI);
    event StatusChanged(uint256 indexed tokenId, PassportStatus status);

    error ZeroBatch();
    error PassportForBatchExists(bytes32 batchId);
    error UnknownPassport(uint256 tokenId);
    error NotManufacturer(uint256 tokenId);
    error InvalidStatusTransition(uint256 tokenId, PassportStatus from, PassportStatus to);

    /// @notice Issue (mint) a passport for a batch. MINTER_ROLE only.
    /// @return tokenId The minted passport id.
    function issue(bytes32 batchId, bytes32 gtin, address manufacturer, string calldata dataURI)
        external
        returns (uint256 tokenId);

    /// @notice Update the off-chain data document URI for a passport.
    function setDataURI(uint256 tokenId, string calldata dataURI) external;

    /// @notice Transition a passport's lifecycle status (suspend/recall/retire/reactivate).
    function setStatus(uint256 tokenId, PassportStatus status) external;

    /// @notice ERC721 metadata URI for a passport.
    function tokenURI(uint256 tokenId) external view returns (string memory);

    /// @notice Passport token id issued for a batch (0 if none).
    function passportOfBatch(bytes32 batchId) external view returns (uint256);

    function passportOf(uint256 tokenId) external view returns (Passport memory);
}
