// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ICustomsBonded } from "../interfaces/ICustomsBonded.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title CustomsBonded
/// @notice Registry of customs surety bonds guaranteeing an importer's duties, taxes and penalties
///         to a customs authority. A surety posts collateral for a coverage amount on behalf of a
///         principal (importer); customs draws against the bond on a defaulted declaration, and the
///         surety's remaining collateral is returned when obligations are released or the bond is
///         revoked.
/// @dev Collateral is custodied in THIS contract. Bond registration is `CUSTOMS_ROLE`-gated; the
///      surety's collateral is pulled via {SafeERC20} at posting time (fee-on-transfer safe). Every
///      fund-moving external is `nonReentrant`. Drawn funds are paid to the drawing customs actor.
contract CustomsBonded is ProofChainAccess, ReentrancyGuard, ICustomsBonded {
    using SafeERC20 for IERC20;

    mapping(bytes32 => CustomsBond) private _bonds;

    /// @notice The settlement token is not on the wired {StablecoinRegistry} allowlist.
    error TokenNotAccepted(address token);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc ICustomsBonded
    function postBond(
        bytes32 bondId,
        BondType bondType,
        address principal,
        address surety,
        bytes32 authority,
        address token,
        uint256 coverageAmount,
        uint64 effectiveFrom,
        uint64 expiresAt
    ) external nonReentrant onlyRole(Roles.CUSTOMS_ROLE) {
        _requireNotGloballyPaused();
        if (principal == address(0) || surety == address(0) || token == address(0)) revert ZeroAddress();
        if (coverageAmount == 0) revert ZeroCoverage();
        if (effectiveFrom >= expiresAt) revert InvalidWindow(effectiveFrom, expiresAt);
        if (_bonds[bondId].state != BondState.None) revert BondExists(bondId);
        _requireAcceptedToken(token);

        // Pull the surety's collateral into custody (fee-on-transfer safe).
        IERC20 erc = IERC20(token);
        uint256 balanceBefore = erc.balanceOf(address(this));
        erc.safeTransferFrom(surety, address(this), coverageAmount);
        uint256 received = erc.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroCoverage();

        _bonds[bondId] = CustomsBond({
            bondId: bondId,
            bondType: bondType,
            principal: principal,
            surety: surety,
            authority: authority,
            token: token,
            coverageAmount: received,
            drawnAmount: 0,
            effectiveFrom: effectiveFrom,
            expiresAt: expiresAt,
            state: BondState.Active
        });

        emit BondPosted(bondId, bondType, principal, surety, authority, received);
    }

    /// @inheritdoc ICustomsBonded
    function draw(bytes32 bondId, bytes32 declarationId, uint256 amount)
        external
        nonReentrant
        onlyRole(Roles.CUSTOMS_ROLE)
    {
        _requireNotGloballyPaused();
        CustomsBond storage bond = _bond(bondId);
        if (bond.state != BondState.Active && bond.state != BondState.Drawn) {
            revert InvalidState(bondId, BondState.Active, bond.state);
        }
        if (amount == 0) revert ZeroCoverage();

        uint256 remaining = bond.coverageAmount - bond.drawnAmount;
        if (amount > remaining) revert CoverageExceeded(bondId, amount, remaining);

        bond.drawnAmount += amount;
        bond.state = bond.drawnAmount == bond.coverageAmount ? BondState.Exhausted : BondState.Drawn;

        // Pay the drawn duties to the drawing customs authority actor.
        IERC20(bond.token).safeTransfer(msg.sender, amount);

        emit BondDrawn(bondId, declarationId, amount, bond.drawnAmount);
    }

    /// @inheritdoc ICustomsBonded
    function release(bytes32 bondId) external nonReentrant onlyRole(Roles.CUSTOMS_ROLE) {
        _requireNotGloballyPaused();
        CustomsBond storage bond = _bond(bondId);
        if (
            bond.state != BondState.Active && bond.state != BondState.Drawn
                && bond.state != BondState.Exhausted
        ) {
            revert InvalidState(bondId, BondState.Active, bond.state);
        }

        bond.state = BondState.Released;
        uint256 refund = bond.coverageAmount - bond.drawnAmount;
        if (refund > 0) IERC20(bond.token).safeTransfer(bond.surety, refund);

        emit BondReleased(bondId);
    }

    /// @inheritdoc ICustomsBonded
    function revoke(bytes32 bondId, bytes32 reason) external nonReentrant onlyRole(Roles.CUSTOMS_ROLE) {
        _requireNotGloballyPaused();
        CustomsBond storage bond = _bond(bondId);
        if (bond.state != BondState.Active && bond.state != BondState.Drawn) {
            revert InvalidState(bondId, BondState.Active, bond.state);
        }

        bond.state = BondState.Revoked;
        uint256 refund = bond.coverageAmount - bond.drawnAmount;
        if (refund > 0) IERC20(bond.token).safeTransfer(bond.surety, refund);

        emit BondRevoked(bondId, reason);
    }

    /// @inheritdoc ICustomsBonded
    function remainingCoverage(bytes32 bondId) external view returns (uint256) {
        CustomsBond storage bond = _bonds[bondId];
        if (bond.state != BondState.Active && bond.state != BondState.Drawn) return 0;
        return bond.coverageAmount - bond.drawnAmount;
    }

    /// @inheritdoc ICustomsBonded
    function bondOf(bytes32 bondId) external view returns (CustomsBond memory) {
        return _bonds[bondId];
    }

    // --------------------------------------------------------------------- internal

    function _bond(bytes32 bondId) private view returns (CustomsBond storage bond) {
        bond = _bonds[bondId];
        if (bond.state == BondState.None) revert UnknownBond(bondId);
    }

    /// @dev Enforce the token allowlist when a {StablecoinRegistry} is wired; skip otherwise.
    function _requireAcceptedToken(address token) private view {
        address reg = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (reg != address(0) && !IStablecoinRegistry(reg).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
