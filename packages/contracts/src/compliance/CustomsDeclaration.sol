// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ICustomsDeclaration } from "../interfaces/ICustomsDeclaration.sol";
import { IDutyAndTariffCalculator } from "../interfaces/IDutyAndTariffCalculator.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";
import { ITreasury } from "../interfaces/ITreasury.sol";

/// @title CustomsDeclaration
/// @notice On-chain customs declaration lifecycle. A declarant lodges a declaration for a batch; customs
///         assesses duty via the {DutyAndTariffCalculator}; the declarant pays the assessed duty into the
///         protocol {Treasury}; customs then releases or holds the goods.
/// @dev Peers resolved via the {AddressBook}. Duty settlement uses {SafeERC20} and is `nonReentrant`;
///      the paid duty is routed into the {Treasury} via `deposit` so protocol balances stay accurate.
contract CustomsDeclaration is ProofChainAccess, ReentrancyGuard, ICustomsDeclaration {
    using SafeERC20 for IERC20;

    mapping(bytes32 => Declaration) private _declarations;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial CUSTOMS_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.CUSTOMS_ROLE, admin);
    }

    /// @inheritdoc ICustomsDeclaration
    function lodge(
        bytes32 declarationId,
        bytes32 batchId,
        bytes32 hsCode,
        bytes32 originCountry,
        bytes32 destinationCountry,
        uint256 customsValue,
        address token
    ) external {
        _requireNotGloballyPaused();
        if (_declarations[declarationId].state != DeclarationState.None) revert DeclarationExists(declarationId);
        if (customsValue == 0) revert ZeroValue();
        if (token == address(0)) revert ZeroAddress();
        _requireAcceptedToken(token);

        _declarations[declarationId] = Declaration({
            declarationId: declarationId,
            batchId: batchId,
            declarant: msg.sender,
            hsCode: hsCode,
            originCountry: originCountry,
            destinationCountry: destinationCountry,
            customsValue: customsValue,
            dutyAssessed: 0,
            token: token,
            state: DeclarationState.Lodged
        });

        emit Lodged(declarationId, batchId, msg.sender, hsCode, customsValue);
    }

    /// @inheritdoc ICustomsDeclaration
    function assess(bytes32 declarationId) external onlyRole(Roles.CUSTOMS_ROLE) returns (uint256 dutyAssessed) {
        _requireNotGloballyPaused();
        Declaration storage decl = _declarations[declarationId];
        _requireState(declarationId, decl, DeclarationState.Lodged);

        IDutyAndTariffCalculator calc = IDutyAndTariffCalculator(_addr(Keys.DUTY_AND_TARIFF_CALCULATOR));
        IDutyAndTariffCalculator.Assessment memory a =
            calc.assess(decl.hsCode, decl.originCountry, decl.destinationCountry, decl.customsValue);

        dutyAssessed = a.totalPayable;
        decl.dutyAssessed = dutyAssessed;
        decl.state = DeclarationState.Assessed;

        emit Assessed(declarationId, dutyAssessed);
    }

    /// @inheritdoc ICustomsDeclaration
    function payDuty(bytes32 declarationId) external nonReentrant {
        _requireNotGloballyPaused();
        Declaration storage decl = _declarations[declarationId];
        _requireState(declarationId, decl, DeclarationState.Assessed);
        if (msg.sender != decl.declarant) revert NotDeclarant(declarationId);

        uint256 amount = decl.dutyAssessed;

        // Effects before interactions.
        decl.state = DeclarationState.Paid;

        if (amount > 0) {
            IERC20 token = IERC20(decl.token);
            address treasury = _addr(Keys.TREASURY);
            // Pull the duty in, then route it into the Treasury's tracked balance via `deposit`.
            token.safeTransferFrom(msg.sender, address(this), amount);
            token.forceApprove(treasury, amount);
            ITreasury(treasury).deposit(decl.token, amount);
        }

        emit Paid(declarationId, amount);
    }

    /// @inheritdoc ICustomsDeclaration
    function release(bytes32 declarationId) external onlyRole(Roles.CUSTOMS_ROLE) {
        _requireNotGloballyPaused();
        Declaration storage decl = _declarations[declarationId];
        _requireState(declarationId, decl, DeclarationState.Paid);

        decl.state = DeclarationState.Released;
        emit Released(declarationId);
    }

    /// @inheritdoc ICustomsDeclaration
    function hold(bytes32 declarationId, string calldata reason) external onlyRole(Roles.CUSTOMS_ROLE) {
        _requireNotGloballyPaused();
        Declaration storage decl = _declarations[declarationId];
        DeclarationState s = decl.state;
        // Holdable while in-flight (lodged/assessed/paid), never once released or cancelled.
        if (s != DeclarationState.Lodged && s != DeclarationState.Assessed && s != DeclarationState.Paid) {
            revert InvalidState(declarationId, DeclarationState.Lodged, s);
        }

        decl.state = DeclarationState.Held;
        emit Held(declarationId, reason);
    }

    /// @inheritdoc ICustomsDeclaration
    function cancel(bytes32 declarationId) external {
        _requireNotGloballyPaused();
        Declaration storage decl = _declarations[declarationId];
        if (decl.state == DeclarationState.None) revert UnknownDeclaration(declarationId);
        if (msg.sender != decl.declarant) revert NotDeclarant(declarationId);
        // Cancellable only before duty is paid (no funds to unwind).
        if (decl.state != DeclarationState.Lodged && decl.state != DeclarationState.Assessed) {
            revert InvalidState(declarationId, DeclarationState.Lodged, decl.state);
        }

        decl.state = DeclarationState.Cancelled;
        emit Cancelled(declarationId);
    }

    /// @inheritdoc ICustomsDeclaration
    function isReleased(bytes32 declarationId) external view returns (bool) {
        return _declarations[declarationId].state == DeclarationState.Released;
    }

    /// @inheritdoc ICustomsDeclaration
    function declarationOf(bytes32 declarationId) external view returns (Declaration memory) {
        return _declarations[declarationId];
    }

    // --------------------------------------------------------------------- internal

    /// @dev Require the declaration to exist and be in the `expected` state.
    function _requireState(bytes32 declarationId, Declaration storage decl, DeclarationState expected)
        internal
        view
    {
        if (decl.state == DeclarationState.None) revert UnknownDeclaration(declarationId);
        if (decl.state != expected) revert InvalidState(declarationId, expected, decl.state);
    }

    /// @dev When the {StablecoinRegistry} is wired, the settlement token must be on its allowlist.
    function _requireAcceptedToken(address token) internal view {
        address reg = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (reg != address(0) && !IStablecoinRegistry(reg).isAccepted(token)) {
            revert IStablecoinRegistry.TokenNotAccepted(token);
        }
    }
}
