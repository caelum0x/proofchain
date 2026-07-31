// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IRenewableEnergyCertificate } from "../interfaces/IRenewableEnergyCertificate.sol";

/// @title RenewableEnergyCertificate
/// @notice ERC1155 Renewable Energy Certificates (RECs / Guarantees of Origin). Each token id is a
///         distinct generation facility + vintage class; one unit == 1 MWh of certified renewable
///         generation. A CERTIFIER registers the class, a MINTER issues RECs against metered output,
///         and holders permanently retire them to claim the green attribute.
/// @dev Retirement burns the units and increments a monotonic per-class `retiredMwh` counter, giving
///      an auditable record that can never be re-minted or double-claimed. Peer dependencies
///      (IoTSensorRegistry meter feeds, SustainabilityOracle, EmissionsTrading) are resolved lazily
///      through the {AddressBook}; this contract never hardcodes peer wiring.
contract RenewableEnergyCertificate is ProofChainAccess, ERC1155, IRenewableEnergyCertificate {
    /// @dev tokenId => registered certificate class (0-issued/0-retired at registration).
    mapping(uint256 => Certificate) private _certs;

    /// @dev tokenId => whether a class has been registered (distinguishes an unregistered id).
    mapping(uint256 => bool) private _registered;

    /// @notice Emitted when a new certificate class is registered for a facility + vintage.
    event ClassRegistered(
        uint256 indexed tokenId, bytes32 indexed facilityId, EnergySource source, uint16 vintageYear
    );

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE plus the initial CERTIFIER and MINTER roles.
    /// @param uri_ Base ERC1155 metadata URI (may embed the `{id}` substitution token).
    constructor(address addressBook_, address admin, string memory uri_)
        ProofChainAccess(addressBook_, admin)
        ERC1155(uri_)
    {
        _grantRole(Roles.CERTIFIER_ROLE, admin);
        _grantRole(Roles.MINTER_ROLE, admin);
    }

    /// @inheritdoc IRenewableEnergyCertificate
    function registerClass(uint256 tokenId, bytes32 facilityId, EnergySource source, uint16 vintageYear)
        external
        override
        onlyRole(Roles.CERTIFIER_ROLE)
    {
        _requireNotGloballyPaused();
        if (_registered[tokenId]) revert CertificateExists(tokenId);

        _registered[tokenId] = true;
        _certs[tokenId] = Certificate({
            tokenId: tokenId,
            facilityId: facilityId,
            source: source,
            vintageYear: vintageYear,
            issuedMwh: 0,
            retiredMwh: 0
        });

        emit ClassRegistered(tokenId, facilityId, source, vintageYear);
    }

    /// @inheritdoc IRenewableEnergyCertificate
    function issue(address to, uint256 tokenId, uint256 mwh) external override onlyRole(Roles.MINTER_ROLE) {
        _requireNotGloballyPaused();
        if (to == address(0)) revert ZeroAddress();
        if (mwh == 0) revert ZeroAmount();
        if (!_registered[tokenId]) revert UnknownCertificate(tokenId);

        Certificate storage cert = _certs[tokenId];
        cert.issuedMwh += mwh;
        _mint(to, tokenId, mwh, "");

        emit CertificateIssued(tokenId, cert.facilityId, cert.source, cert.vintageYear, mwh);
    }

    /// @inheritdoc IRenewableEnergyCertificate
    function retire(uint256 tokenId, uint256 mwh, bytes32 beneficiary) external override {
        _requireNotGloballyPaused();
        if (mwh == 0) revert ZeroAmount();
        if (!_registered[tokenId]) revert UnknownCertificate(tokenId);

        uint256 available = balanceOf(msg.sender, tokenId);
        if (available < mwh) revert InsufficientCertificates(tokenId, mwh, available);

        _certs[tokenId].retiredMwh += mwh;
        _burn(msg.sender, tokenId, mwh);

        emit CertificateRetired(msg.sender, tokenId, mwh, beneficiary);
    }

    /// @inheritdoc IRenewableEnergyCertificate
    function retiredOf(uint256 tokenId) external view override returns (uint256) {
        return _certs[tokenId].retiredMwh;
    }

    /// @inheritdoc IRenewableEnergyCertificate
    function certificateOf(uint256 tokenId) external view override returns (Certificate memory) {
        if (!_registered[tokenId]) revert UnknownCertificate(tokenId);
        return _certs[tokenId];
    }

    /// @dev Resolve the ERC165/AccessControl multiple-inheritance ambiguity.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl, IERC165)
        returns (bool)
    {
        return ERC1155.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }
}
