// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/// @title IRenewableEnergyCertificate
/// @notice ERC1155 Renewable Energy Certificates (RECs / Guarantees of Origin). One token id encodes a
///         generation facility + vintage; one unit == 1 MWh of certified renewable generation. Issued to
///         generators against metered output and permanently retired by consumers to claim green attributes.
/// @dev deps (AddressBook): IoTSensorRegistry (meter feeds), SustainabilityOracle, EmissionsTrading.
interface IRenewableEnergyCertificate is IERC1155 {
    enum EnergySource {
        Solar,
        Wind,
        Hydro,
        Geothermal,
        Biomass,
        Nuclear
    }

    struct Certificate {
        uint256 tokenId;
        bytes32 facilityId;
        EnergySource source;
        uint16 vintageYear;
        uint256 issuedMwh;
        uint256 retiredMwh;
    }

    event CertificateIssued(
        uint256 indexed tokenId, bytes32 indexed facilityId, EnergySource source, uint16 vintageYear, uint256 mwh
    );
    event CertificateRetired(address indexed account, uint256 indexed tokenId, uint256 mwh, bytes32 beneficiary);

    error ZeroAmount();
    error UnknownCertificate(uint256 tokenId);
    error CertificateExists(uint256 tokenId);
    error InsufficientCertificates(uint256 tokenId, uint256 requested, uint256 available);

    /// @notice Register a certificate class for a facility+vintage. CERTIFIER_ROLE only.
    function registerClass(uint256 tokenId, bytes32 facilityId, EnergySource source, uint16 vintageYear) external;

    /// @notice Issue (mint) RECs against certified generation. MINTER_ROLE only.
    function issue(address to, uint256 tokenId, uint256 mwh) external;

    /// @notice Permanently retire RECs held by the caller and record the claiming beneficiary.
    function retire(uint256 tokenId, uint256 mwh, bytes32 beneficiary) external;

    /// @notice Total MWh retired for a certificate class.
    function retiredOf(uint256 tokenId) external view returns (uint256);

    function certificateOf(uint256 tokenId) external view returns (Certificate memory);
}
