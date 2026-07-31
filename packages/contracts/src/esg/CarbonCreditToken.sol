// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { ICarbonCreditToken } from "../interfaces/ICarbonCreditToken.sol";

/// @title CarbonCreditToken
/// @notice ERC1155 tokenized carbon offsets. Each `projectId` (== token id) is a distinct
///         verified carbon project; balances are transferable until permanently retired.
/// @dev Retirement burns the credits and increments an immutable retired counter per project,
///      giving an auditable, monotonic record of offsets that can never be re-minted or reused.
///      A gated {retireFrom} lets an approved operator (e.g. the {OffsetMarketplace}) retire a
///      holder's credits on their behalf using standard ERC1155 operator approval.
contract CarbonCreditToken is ProofChainAccess, ERC1155, ICarbonCreditToken {
    /// @dev Extra error for operator-gated retirement (beyond the interface surface).
    error NotAuthorized(address operator, address account);

    /// @dev projectId => cumulative amount permanently retired.
    mapping(uint256 => uint256) private _retired;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial MINTER_ROLE.
    /// @param uri_ Base ERC1155 metadata URI (may embed the `{id}` substitution token).
    constructor(address addressBook_, address admin, string memory uri_)
        ProofChainAccess(addressBook_, admin)
        ERC1155(uri_)
    {
        _grantRole(Roles.MINTER_ROLE, admin);
    }

    /// @inheritdoc ICarbonCreditToken
    function mint(address to, uint256 projectId, uint256 amount)
        external
        override
        onlyRole(Roles.MINTER_ROLE)
    {
        _requireNotGloballyPaused();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, projectId, amount, "");
    }

    /// @inheritdoc ICarbonCreditToken
    function retire(uint256 projectId, uint256 amount) external override {
        _retire(msg.sender, projectId, amount);
    }

    /// @notice Retire credits held by `account`. Callable by `account` itself or an approved
    ///         ERC1155 operator (mirrors {ERC1155Burnable} authorization semantics).
    /// @dev Enables the {OffsetMarketplace} to retire a user's credits after they grant it
    ///      `setApprovalForAll`, without the token ever leaving the holder's custody.
    function retireFrom(address account, uint256 projectId, uint256 amount) external {
        if (account != msg.sender && !isApprovedForAll(account, msg.sender)) {
            revert NotAuthorized(msg.sender, account);
        }
        _retire(account, projectId, amount);
    }

    /// @inheritdoc ICarbonCreditToken
    function retiredOf(uint256 projectId) external view override returns (uint256) {
        return _retired[projectId];
    }

    /// @dev Shared retirement logic: validate, burn, record, and emit.
    function _retire(address account, uint256 projectId, uint256 amount) private {
        _requireNotGloballyPaused();
        if (amount == 0) revert ZeroAmount();

        uint256 balance = balanceOf(account, projectId);
        if (balance < amount) revert InsufficientCredits(projectId, amount, balance);

        _burn(account, projectId, amount);
        _retired[projectId] += amount;
        emit Retired(account, projectId, amount);
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
