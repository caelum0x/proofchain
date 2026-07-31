// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IOffsetMarketplace } from "../interfaces/IOffsetMarketplace.sol";
import { ICarbonCreditToken } from "../interfaces/ICarbonCreditToken.sol";
import { ISustainabilityOracle } from "../interfaces/ISustainabilityOracle.sol";

/// @title OffsetMarketplace
/// @notice Retires carbon credits against a batch's measured footprint. A holder approves this
///         contract as an ERC1155 operator, then calls {offset}: their credits are pulled in and
///         permanently retired, reducing the batch's remaining un-offset footprint.
/// @dev Peers ({CarbonCreditToken}, {SustainabilityOracle}) are resolved through the
///      {AddressBook} and used strictly via their interfaces. Follows checks-effects-interactions
///      and is `nonReentrant` because it makes external ERC1155 calls. Inherits {ERC1155Holder}
///      so it can custody credits for the burn step of retirement.
contract OffsetMarketplace is ProofChainAccess, ReentrancyGuard, ERC1155Holder, IOffsetMarketplace {
    /// @dev batchId => cumulative credits retired against its footprint.
    mapping(bytes32 => uint256) private _offsetted;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the carbon token + oracle.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IOffsetMarketplace
    function offset(bytes32 batchId, uint256 projectId, uint256 amount) external override nonReentrant {
        _requireNotGloballyPaused();
        if (amount == 0) revert ZeroAmount();

        ISustainabilityOracle oracle = ISustainabilityOracle(_addr(Keys.SUSTAINABILITY_ORACLE));
        uint256 footprint = oracle.emissionsOf(batchId);
        if (footprint == 0) revert NothingToOffset(batchId);

        uint256 already = _offsetted[batchId];
        if (already >= footprint) revert NothingToOffset(batchId);

        // Effects before interactions: record the offset up front (CEI + reentrancy safety).
        _offsetted[batchId] = already + amount;

        // Interactions: pull the holder's credits in, then permanently retire them.
        ICarbonCreditToken carbon = ICarbonCreditToken(_addr(Keys.CARBON_CREDIT_TOKEN));
        carbon.safeTransferFrom(msg.sender, address(this), projectId, amount, "");
        carbon.retire(projectId, amount);

        emit Offset(batchId, msg.sender, projectId, amount);
    }

    /// @inheritdoc IOffsetMarketplace
    function remainingFootprint(bytes32 batchId) external view override returns (uint256) {
        ISustainabilityOracle oracle = ISustainabilityOracle(_addr(Keys.SUSTAINABILITY_ORACLE));
        uint256 footprint = oracle.emissionsOf(batchId);
        uint256 already = _offsetted[batchId];
        return footprint > already ? footprint - already : 0;
    }

    /// @notice Total credits retired against a batch's footprint so far.
    function offsettedOf(bytes32 batchId) external view returns (uint256) {
        return _offsetted[batchId];
    }

    /// @dev Resolve the ERC165 ambiguity between AccessControl and ERC1155Holder.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl, ERC1155Holder)
        returns (bool)
    {
        return AccessControl.supportsInterface(interfaceId) || ERC1155Holder.supportsInterface(interfaceId);
    }
}
