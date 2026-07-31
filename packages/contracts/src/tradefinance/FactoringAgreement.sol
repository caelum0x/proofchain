// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IFactoringAgreement } from "../interfaces/IFactoringAgreement.sol";
import { IAttestationRegistry } from "../interfaces/IAttestationRegistry.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title FactoringAgreement
/// @notice A seller assigns an AI-attested receivable to a factor. The factor advances a percentage
///         of face value up-front and, at collection from the debtor, recoups the advance plus a
///         factoring fee, rebating the surplus reserve to the seller. Recourse agreements charge the
///         seller back the advance on debtor default.
/// @dev Fund movement uses {SafeERC20} and `nonReentrant`. Collection and recourse pull funds from
///      the debtor / seller respectively (they must approve this contract). Peers via {AddressBook}.
contract FactoringAgreement is ProofChainAccess, ReentrancyGuard, IFactoringAgreement {
    using SafeERC20 for IERC20;

    uint16 private constant BPS = 10_000;

    mapping(bytes32 => Agreement) private _agreements;

    /// @notice A settlement token outside the {StablecoinRegistry} allowlist was supplied.
    error TokenNotAccepted(address token);
    /// @notice Default was asserted before the receivable's maturity.
    error NotYetDue(bytes32 agreementId, uint64 maturity);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IFactoringAgreement
    function offer(
        bytes32 agreementId,
        bytes32 batchId,
        address debtor,
        address token,
        uint256 faceAmount,
        uint16 advanceRateBps,
        uint16 feeBps,
        uint64 maturity,
        bool recourse
    ) external {
        _requireNotGloballyPaused();
        if (_agreements[agreementId].state != AgreementState.None) revert AgreementExists(agreementId);
        if (faceAmount == 0) revert ZeroAmount();
        if (debtor == address(0) || token == address(0)) revert ZeroAddress();
        if (advanceRateBps == 0 || advanceRateBps > BPS || feeBps >= BPS) revert InvalidRate(advanceRateBps);
        if (!IAttestationRegistry(_addr(Keys.ATTESTATION_REGISTRY)).isAttested(batchId)) revert NotAttested(batchId);
        _requireAccepted(token);

        uint256 advanceAmount = (faceAmount * advanceRateBps) / BPS;

        _agreements[agreementId] = Agreement({
            agreementId: agreementId,
            batchId: batchId,
            seller: msg.sender,
            factor: address(0),
            debtor: debtor,
            token: token,
            faceAmount: faceAmount,
            advanceAmount: advanceAmount,
            feeBps: feeBps,
            maturity: maturity,
            recourse: recourse,
            state: AgreementState.Offered
        });

        emit Offered(agreementId, batchId, msg.sender, token, faceAmount, advanceRateBps, feeBps);
    }

    /// @inheritdoc IFactoringAgreement
    function fund(bytes32 agreementId) external nonReentrant {
        Agreement storage a = _agreements[agreementId];
        _requireExists(a, agreementId);
        if (a.state != AgreementState.Offered) revert InvalidState(agreementId, AgreementState.Offered, a.state);

        a.factor = msg.sender;
        a.state = AgreementState.Funded;

        // Advance the discounted amount from the factor straight to the seller.
        IERC20(a.token).safeTransferFrom(msg.sender, a.seller, a.advanceAmount);
        emit Funded(agreementId, msg.sender, a.advanceAmount);
    }

    /// @inheritdoc IFactoringAgreement
    function collect(bytes32 agreementId) external nonReentrant {
        Agreement storage a = _agreements[agreementId];
        _requireExists(a, agreementId);
        if (a.state != AgreementState.Funded) revert InvalidState(agreementId, AgreementState.Funded, a.state);
        if (msg.sender != a.factor) revert NotFactor(agreementId);

        uint256 face = a.faceAmount;
        uint256 fee = (face * a.feeBps) / BPS;
        uint256 factorTake = a.advanceAmount + fee;
        if (factorTake > face) factorTake = face;
        uint256 rebate = face - factorTake;

        a.state = AgreementState.Collected;

        IERC20 token = IERC20(a.token);
        // Pull the full face value from the debtor, then net the factor's principal + fee and
        // rebate the surplus reserve to the seller.
        token.safeTransferFrom(a.debtor, address(this), face);
        if (factorTake > 0) token.safeTransfer(a.factor, factorTake);
        if (rebate > 0) token.safeTransfer(a.seller, rebate);

        emit Collected(agreementId, face, fee, rebate);
    }

    /// @inheritdoc IFactoringAgreement
    function markDefault(bytes32 agreementId) external nonReentrant {
        Agreement storage a = _agreements[agreementId];
        _requireExists(a, agreementId);
        if (a.state != AgreementState.Funded) revert InvalidState(agreementId, AgreementState.Funded, a.state);
        if (msg.sender != a.factor) revert NotFactor(agreementId);
        if (block.timestamp < a.maturity) revert NotYetDue(agreementId, a.maturity);

        uint256 recourseCharged;
        a.state = AgreementState.Defaulted;

        if (a.recourse) {
            // Recourse: the seller reimburses the factor's advance on debtor default.
            recourseCharged = a.advanceAmount;
            IERC20(a.token).safeTransferFrom(a.seller, a.factor, recourseCharged);
        }

        emit Defaulted(agreementId, recourseCharged);
    }

    /// @inheritdoc IFactoringAgreement
    function cancel(bytes32 agreementId) external {
        Agreement storage a = _agreements[agreementId];
        _requireExists(a, agreementId);
        if (a.state != AgreementState.Offered) revert InvalidState(agreementId, AgreementState.Offered, a.state);
        if (msg.sender != a.seller) revert NotSeller(agreementId);

        a.state = AgreementState.Cancelled;
        emit Cancelled(agreementId);
    }

    /// @inheritdoc IFactoringAgreement
    function agreementOf(bytes32 agreementId) external view returns (Agreement memory) {
        return _agreements[agreementId];
    }

    function _requireExists(Agreement storage a, bytes32 agreementId) private view {
        if (a.state == AgreementState.None) revert UnknownAgreement(agreementId);
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
