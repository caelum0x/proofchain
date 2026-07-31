// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IGuaranteeRegistry } from "../interfaces/IGuaranteeRegistry.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title GuaranteeRegistry
/// @notice Bank guarantees / standby letters of credit. A guarantor (UNDERWRITER_ROLE) issues an
///         undertaking backed by escrowed collateral: on principal default the beneficiary calls the
///         guarantee and the guarantor pays out from collateral; otherwise the guarantor releases the
///         collateral at expiry.
/// @dev Collateral is escrowed on issue. Pay-out / release / expiry move funds via {SafeERC20} and
///      are `nonReentrant`. Peers resolved via {AddressBook}.
contract GuaranteeRegistry is ProofChainAccess, ReentrancyGuard, IGuaranteeRegistry {
    using SafeERC20 for IERC20;

    mapping(bytes32 => Guarantee) private _guarantees;

    /// @notice A settlement token outside the {StablecoinRegistry} allowlist was supplied.
    error TokenNotAccepted(address token);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial UNDERWRITER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.UNDERWRITER_ROLE, admin);
    }

    /// @inheritdoc IGuaranteeRegistry
    function issue(
        bytes32 guaranteeId,
        GuaranteeType gType,
        address principal,
        address beneficiary,
        address token,
        uint256 amount,
        uint64 expiry,
        bytes32 termsHash
    ) external nonReentrant onlyRole(Roles.UNDERWRITER_ROLE) {
        _requireNotGloballyPaused();
        if (_guarantees[guaranteeId].state != GuaranteeState.None) revert GuaranteeExists(guaranteeId);
        if (amount == 0) revert ZeroAmount();
        if (principal == address(0) || beneficiary == address(0) || token == address(0)) revert ZeroAddress();
        if (expiry <= block.timestamp) revert PastExpiry(expiry);
        _requireAccepted(token);

        _guarantees[guaranteeId] = Guarantee({
            guaranteeId: guaranteeId,
            gType: gType,
            guarantor: msg.sender,
            principal: principal,
            beneficiary: beneficiary,
            token: token,
            amount: amount,
            expiry: expiry,
            termsHash: termsHash,
            state: GuaranteeState.Issued
        });

        // Escrow the guarantee collateral from the guarantor.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Issued(guaranteeId, gType, msg.sender, beneficiary, principal, token, amount, expiry);
    }

    /// @inheritdoc IGuaranteeRegistry
    function call(bytes32 guaranteeId, string calldata reason) external {
        Guarantee storage g = _guarantees[guaranteeId];
        _requireExists(g, guaranteeId);
        if (g.state != GuaranteeState.Issued) revert InvalidState(guaranteeId, GuaranteeState.Issued, g.state);
        if (msg.sender != g.beneficiary) revert NotBeneficiary(guaranteeId);
        if (block.timestamp > g.expiry) revert GuaranteeExpired(guaranteeId);

        g.state = GuaranteeState.Called;
        emit Called(guaranteeId, msg.sender, reason);
    }

    /// @inheritdoc IGuaranteeRegistry
    function payOut(bytes32 guaranteeId) external nonReentrant {
        Guarantee storage g = _guarantees[guaranteeId];
        _requireExists(g, guaranteeId);
        if (g.state != GuaranteeState.Called) revert InvalidState(guaranteeId, GuaranteeState.Called, g.state);
        if (msg.sender != g.guarantor) revert NotGuarantor(guaranteeId);

        uint256 amount = g.amount;
        address beneficiary = g.beneficiary;
        g.state = GuaranteeState.PaidOut;

        IERC20(g.token).safeTransfer(beneficiary, amount);
        emit PaidOut(guaranteeId, beneficiary, amount);
    }

    /// @inheritdoc IGuaranteeRegistry
    function release(bytes32 guaranteeId) external nonReentrant {
        Guarantee storage g = _guarantees[guaranteeId];
        _requireExists(g, guaranteeId);
        if (g.state != GuaranteeState.Issued) revert InvalidState(guaranteeId, GuaranteeState.Issued, g.state);
        if (msg.sender != g.guarantor) revert NotGuarantor(guaranteeId);

        uint256 amount = g.amount;
        address guarantor = g.guarantor;
        g.state = GuaranteeState.Released;

        IERC20(g.token).safeTransfer(guarantor, amount);
        emit Released(guaranteeId);
    }

    /// @inheritdoc IGuaranteeRegistry
    function expire(bytes32 guaranteeId) external nonReentrant {
        Guarantee storage g = _guarantees[guaranteeId];
        _requireExists(g, guaranteeId);
        if (g.state != GuaranteeState.Issued) revert InvalidState(guaranteeId, GuaranteeState.Issued, g.state);
        if (block.timestamp <= g.expiry) revert PastExpiry(g.expiry);

        uint256 amount = g.amount;
        address guarantor = g.guarantor;
        g.state = GuaranteeState.Expired;

        // Uncalled at expiry: collateral returns to the guarantor.
        IERC20(g.token).safeTransfer(guarantor, amount);
        emit Expired(guaranteeId);
    }

    /// @inheritdoc IGuaranteeRegistry
    function guaranteeOf(bytes32 guaranteeId) external view returns (Guarantee memory) {
        return _guarantees[guaranteeId];
    }

    function _requireExists(Guarantee storage g, bytes32 guaranteeId) private view {
        if (g.state == GuaranteeState.None) revert UnknownGuarantee(guaranteeId);
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
