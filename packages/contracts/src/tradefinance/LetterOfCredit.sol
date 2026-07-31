// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ILetterOfCredit } from "../interfaces/ILetterOfCredit.sol";
import { IAttestationRegistry } from "../interfaces/IAttestationRegistry.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title LetterOfCredit
/// @notice Documentary Letter of Credit. An issuing bank (UNDERWRITER_ROLE) opens an irrevocable
///         undertaking, escrowing `amount` of `token`. The beneficiary presents shipping documents;
///         the issuer accepts them — gated on an AI attestation for the batch — and the beneficiary
///         is paid from escrow. Rejection, expiry and pre-presentation cancellation return the
///         escrowed collateral to the applicant (the account party who ultimately funds the margin).
/// @dev Peers resolved via {AddressBook}. All fund movement uses {SafeERC20} and is `nonReentrant`.
///      Integrates the core {AttestationRegistry} so an LC cannot pay against unverified goods.
contract LetterOfCredit is ProofChainAccess, ReentrancyGuard, ILetterOfCredit {
    using SafeERC20 for IERC20;

    mapping(bytes32 => Credit) private _credits;

    /// @notice A settlement token outside the {StablecoinRegistry} allowlist was supplied.
    error TokenNotAccepted(address token);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial UNDERWRITER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.UNDERWRITER_ROLE, admin);
    }

    /// @inheritdoc ILetterOfCredit
    function issue(
        bytes32 lcId,
        bytes32 batchId,
        address applicant,
        address beneficiary,
        address token,
        uint256 amount,
        uint64 expiry,
        bytes32 termsHash
    ) external nonReentrant onlyRole(Roles.UNDERWRITER_ROLE) {
        _requireNotGloballyPaused();
        if (_credits[lcId].state != LCState.None) revert CreditExists(lcId);
        if (amount == 0) revert ZeroAmount();
        if (applicant == address(0) || beneficiary == address(0) || token == address(0)) revert ZeroAddress();
        if (expiry <= block.timestamp) revert PastExpiry(expiry);
        _requireAccepted(token);

        _credits[lcId] = Credit({
            lcId: lcId,
            batchId: batchId,
            applicant: applicant,
            beneficiary: beneficiary,
            issuer: msg.sender,
            token: token,
            amount: amount,
            expiry: expiry,
            termsHash: termsHash,
            documentsHash: bytes32(0),
            state: LCState.Issued
        });

        // Escrow the undertaking amount from the issuing bank.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit Issued(lcId, batchId, beneficiary, applicant, token, amount, expiry);
    }

    /// @inheritdoc ILetterOfCredit
    function presentDocuments(bytes32 lcId, bytes32 documentsHash) external {
        Credit storage c = _credits[lcId];
        _requireExists(c, lcId);
        if (c.state != LCState.Issued) revert InvalidState(lcId, LCState.Issued, c.state);
        if (msg.sender != c.beneficiary) revert NotBeneficiary(lcId);
        if (block.timestamp > c.expiry) revert CreditExpired(lcId);

        c.documentsHash = documentsHash;
        c.state = LCState.DocumentsPresented;
        emit DocumentsPresented(lcId, documentsHash, msg.sender);
    }

    /// @inheritdoc ILetterOfCredit
    function accept(bytes32 lcId) external nonReentrant {
        Credit storage c = _credits[lcId];
        _requireExists(c, lcId);
        if (c.state != LCState.DocumentsPresented) revert InvalidState(lcId, LCState.DocumentsPresented, c.state);
        if (msg.sender != c.issuer) revert NotIssuer(lcId);
        // Documents may only be accepted against an AI-verified batch attestation.
        if (!IAttestationRegistry(_addr(Keys.ATTESTATION_REGISTRY)).isAttested(c.batchId)) {
            revert DocumentsNotAttested(lcId);
        }

        uint256 amount = c.amount;
        address beneficiary = c.beneficiary;
        c.state = LCState.Paid;

        emit Accepted(lcId, msg.sender);
        IERC20(c.token).safeTransfer(beneficiary, amount);
        emit Paid(lcId, beneficiary, amount);
    }

    /// @inheritdoc ILetterOfCredit
    function reject(bytes32 lcId, string calldata reason) external nonReentrant {
        Credit storage c = _credits[lcId];
        _requireExists(c, lcId);
        if (c.state != LCState.DocumentsPresented) revert InvalidState(lcId, LCState.DocumentsPresented, c.state);
        if (msg.sender != c.issuer) revert NotIssuer(lcId);

        uint256 amount = c.amount;
        address applicant = c.applicant;
        c.state = LCState.Rejected;

        // Discrepant presentation: return the escrowed collateral to the account party.
        IERC20(c.token).safeTransfer(applicant, amount);
        emit Rejected(lcId, reason);
    }

    /// @inheritdoc ILetterOfCredit
    function expire(bytes32 lcId) external nonReentrant {
        Credit storage c = _credits[lcId];
        _requireExists(c, lcId);
        if (c.state != LCState.Issued && c.state != LCState.DocumentsPresented) {
            revert InvalidState(lcId, LCState.Issued, c.state);
        }
        if (block.timestamp <= c.expiry) revert PastExpiry(c.expiry);

        uint256 amount = c.amount;
        address applicant = c.applicant;
        c.state = LCState.Expired;

        IERC20(c.token).safeTransfer(applicant, amount);
        emit Expired(lcId);
    }

    /// @inheritdoc ILetterOfCredit
    function cancel(bytes32 lcId) external nonReentrant {
        Credit storage c = _credits[lcId];
        _requireExists(c, lcId);
        if (c.state != LCState.Issued) revert InvalidState(lcId, LCState.Issued, c.state);
        if (msg.sender != c.applicant && msg.sender != c.issuer) revert NotApplicant(lcId);

        uint256 amount = c.amount;
        address applicant = c.applicant;
        c.state = LCState.Cancelled;

        IERC20(c.token).safeTransfer(applicant, amount);
        emit Cancelled(lcId);
    }

    /// @inheritdoc ILetterOfCredit
    function creditOf(bytes32 lcId) external view returns (Credit memory) {
        return _credits[lcId];
    }

    /// @inheritdoc ILetterOfCredit
    function stateOf(bytes32 lcId) external view returns (LCState) {
        return _credits[lcId].state;
    }

    function _requireExists(Credit storage c, bytes32 lcId) private view {
        if (c.state == LCState.None) revert UnknownCredit(lcId);
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
