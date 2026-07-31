// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ISettlementEscrow } from "./interfaces/ISettlementEscrow.sol";
import { IAttestationRegistry } from "./interfaces/IAttestationRegistry.sol";
import { IProvenanceRegistry } from "./interfaces/IProvenanceRegistry.sol";
import { IAddressBook } from "./interfaces/IAddressBook.sol";
import { IReputationEngine } from "./interfaces/IReputationEngine.sol";
import { Keys } from "./core/Keys.sol";
import { Roles } from "./core/Roles.sol";

/// @title SettlementEscrow
/// @notice Holds buyer funds; releases to the (possibly overridden) payee only when a passing
///         attestation exists. Failing attestations move a deal to `Disputed` for resolution.
/// @dev M2 extensions layered additively on top of the original escrow so the existing test
///      suite keeps passing:
///        - `payeeOverride`/`setPayee`: a supplier may assign a Funded deal's payout to a
///          financier (invoice financing) — release then pays the override.
///        - `ARBITER_ROLE`/`arbiterRelease`: an arbiter may release a Disputed deal to the payee.
///        - Optional {ReputationEngine} hook: if an {AddressBook} is wired via `setAddressBook`
///          and it resolves a `ReputationEngine`, settlement outcomes are recorded (best effort).
///      Uses SafeERC20 for transfers, ReentrancyGuard on fund/settle/refund/arbiterRelease,
///      Pausable admin gate on fund/settle.
contract SettlementEscrow is ISettlementEscrow, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Default passing threshold in basis points.
    uint16 public constant DEFAULT_PASS_THRESHOLD = 7000;

    /// @notice Maximum threshold / score in basis points.
    uint16 public constant MAX_BPS = 10_000;

    /// @inheritdoc ISettlementEscrow
    bytes32 public constant override ARBITER_ROLE = Roles.ARBITER_ROLE;

    IAttestationRegistry public immutable attestations;
    IProvenanceRegistry public immutable provenance;

    /// @inheritdoc ISettlementEscrow
    uint16 public override passThreshold;

    /// @notice Optional service registry used to resolve the optional {ReputationEngine} hook.
    /// @dev Left unset by default so the base escrow behaves exactly as before (existing tests).
    IAddressBook public addressBook;

    mapping(bytes32 => Deal) private _deals;
    mapping(bytes32 => address) private _payeeOverride;

    /// @notice Emitted when the optional AddressBook (for the reputation hook) is configured.
    event AddressBookSet(address indexed addressBook);

    /// @param admin Address granted DEFAULT_ADMIN_ROLE (also dispute resolver / pauser).
    /// @param attestationRegistry Address of the AttestationRegistry.
    /// @param provenanceRegistry Address of the ProvenanceRegistry.
    constructor(address admin, address attestationRegistry, address provenanceRegistry) {
        if (admin == address(0) || attestationRegistry == address(0) || provenanceRegistry == address(0)) {
            revert ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        attestations = IAttestationRegistry(attestationRegistry);
        provenance = IProvenanceRegistry(provenanceRegistry);
        passThreshold = DEFAULT_PASS_THRESHOLD;
    }

    /// @notice Update the passing threshold. Admin only.
    function setPassThreshold(uint16 newThreshold) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newThreshold == 0 || newThreshold > MAX_BPS) revert InvalidThreshold(newThreshold);
        uint16 old = passThreshold;
        passThreshold = newThreshold;
        emit PassThresholdUpdated(old, newThreshold);
    }

    /// @notice Wire the optional AddressBook used to resolve the {ReputationEngine} hook. Admin only.
    /// @dev When set, release/dispute outcomes are recorded on the engine (best-effort, never
    ///      reverting settlement). Leave unset to disable the hook entirely.
    function setAddressBook(address addressBook_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (addressBook_ == address(0)) revert ZeroAddress();
        addressBook = IAddressBook(addressBook_);
        emit AddressBookSet(addressBook_);
    }

    /// @notice Pause fund/settle. Admin only.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause. Admin only.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Buyer funds a deal by escrowing `amount` of `token` against a known batch.
    /// @dev Buyer must approve this contract first. Pulls funds via safeTransferFrom.
    function fund(bytes32 batchId, address supplier, address token, uint256 amount)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (amount == 0) revert ZeroAmount();
        if (supplier == address(0) || token == address(0)) revert ZeroAddress();
        if (_deals[batchId].state != DealState.None) revert DealExists(batchId);
        if (!provenance.batchExists(batchId)) revert UnknownBatch(batchId);
        // Provenance-to-payment guarantee: the funded supplier must be the
        // address that actually registered the batch on-chain.
        if (provenance.batchSupplier(batchId) != supplier) revert SupplierMismatch(batchId);

        // Record the amount ACTUALLY received so fee-on-transfer / rebasing
        // tokens can never leave the escrow holding less than deal.amount
        // (which would brick settle()/refund()).
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        _deals[batchId] = Deal({
            batchId: batchId,
            buyer: msg.sender,
            supplier: supplier,
            token: token,
            amount: received,
            state: DealState.Funded
        });

        emit Funded(batchId, msg.sender, supplier, token, received);
    }

    /// @notice Settle a funded deal against its attestation. Anyone may call.
    /// @dev Passing score -> release to the effective payee; failing score -> mark Disputed
    ///      (no auto-refund). Records the outcome on the optional {ReputationEngine} hook.
    function settle(bytes32 batchId) external override nonReentrant whenNotPaused {
        Deal storage deal = _deals[batchId];
        if (deal.state == DealState.None) revert NotFunded(batchId);
        if (deal.state != DealState.Funded) revert AlreadySettled(batchId);
        if (!attestations.isAttested(batchId)) revert NotAttested(batchId);

        uint16 score = attestations.scoreOf(batchId);

        if (score >= passThreshold) {
            deal.state = DealState.Released;
            address payee = _effectivePayee(batchId);
            IERC20(deal.token).safeTransfer(payee, deal.amount);
            emit Released(batchId, payee, deal.amount);
            _recordOutcome(deal.supplier, true, score);
        } else {
            deal.state = DealState.Disputed;
            emit Disputed(batchId, score);
            _recordOutcome(deal.supplier, false, score);
        }
    }

    /// @notice Refund a disputed deal back to the buyer. Admin (dispute resolver) only.
    function refund(bytes32 batchId) external override nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        Deal storage deal = _deals[batchId];
        if (deal.state != DealState.Disputed) revert NotDisputed(batchId);

        deal.state = DealState.Refunded;
        IERC20(deal.token).safeTransfer(deal.buyer, deal.amount);
        emit Refunded(batchId, deal.buyer, deal.amount);
    }

    // -------------------------------------------------------------------------
    // M2 extensions
    // -------------------------------------------------------------------------

    /// @notice Supplier reassigns the payout target for a Funded deal (invoice financing).
    /// @dev Only the deal's supplier may reassign, and only while the deal is still `Funded`.
    function setPayee(bytes32 batchId, address payee) external override {
        if (payee == address(0)) revert ZeroAddress();
        Deal storage deal = _deals[batchId];
        if (msg.sender != deal.supplier) revert NotSupplier(batchId);
        if (deal.state != DealState.Funded) revert NotFundedState(batchId);

        _payeeOverride[batchId] = payee;
        emit PayeeSet(batchId, payee);
    }

    /// @notice The effective payout target for a batch (override if set, else the supplier).
    function payeeOverride(bytes32 batchId) external view override returns (address) {
        return _effectivePayee(batchId);
    }

    /// @notice Arbiter releases a Disputed deal to the (possibly overridden) payee. ARBITER_ROLE only.
    function arbiterRelease(bytes32 batchId) external override nonReentrant onlyRole(ARBITER_ROLE) {
        Deal storage deal = _deals[batchId];
        if (deal.state != DealState.Disputed) revert NotDisputed(batchId);

        deal.state = DealState.Released;
        address payee = _effectivePayee(batchId);
        IERC20(deal.token).safeTransfer(payee, deal.amount);
        emit ArbiterReleased(batchId, payee, deal.amount);
        _recordOutcome(deal.supplier, true, attestations.scoreOf(batchId));
    }

    /// @notice Fetch a deal by batch id.
    function getDeal(bytes32 batchId) external view override returns (Deal memory) {
        return _deals[batchId];
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    /// @dev Resolve the effective payee: the financing override if assigned, else the supplier.
    function _effectivePayee(bytes32 batchId) internal view returns (address) {
        address overridePayee = _payeeOverride[batchId];
        if (overridePayee != address(0)) return overridePayee;
        return _deals[batchId].supplier;
    }

    /// @dev Best-effort reputation recording via the optional {ReputationEngine}. Never reverts
    ///      settlement: a missing AddressBook, unset key, or missing role degrades gracefully.
    function _recordOutcome(address supplier, bool passed, uint16 score) internal {
        IAddressBook book = addressBook;
        if (address(book) == address(0)) return;
        address engine = book.getAddress(Keys.REPUTATION_ENGINE);
        if (engine == address(0)) return;
        // solhint-disable-next-line no-empty-blocks
        try IReputationEngine(engine).recordOutcome(supplier, passed, score) { }
        catch { /* graceful degradation: reputation is advisory, not settlement-critical */ }
    }
}
