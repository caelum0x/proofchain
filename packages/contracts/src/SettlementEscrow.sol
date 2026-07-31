// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IAttestationRegistry } from "./interfaces/IAttestationRegistry.sol";
import { IProvenanceRegistry } from "./interfaces/IProvenanceRegistry.sol";

/// @title SettlementEscrow
/// @notice Holds buyer funds; releases to supplier only when a passing attestation exists.
/// @dev Uses SafeERC20 for transfers, ReentrancyGuard on fund/settle/refund, Pausable admin gate.
contract SettlementEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Default passing threshold in basis points.
    uint16 public constant DEFAULT_PASS_THRESHOLD = 7000;

    /// @notice Maximum threshold / score in basis points.
    uint16 public constant MAX_BPS = 10_000;

    enum DealState {
        None,
        Funded,
        Released,
        Refunded,
        Disputed
    }

    struct Deal {
        bytes32 batchId;
        address buyer;
        address supplier;
        address token;
        uint256 amount;
        DealState state;
    }

    IAttestationRegistry public immutable attestations;
    IProvenanceRegistry public immutable provenance;

    /// @notice Passing score threshold in bps; deals scoring >= this are released.
    uint16 public passThreshold;

    mapping(bytes32 => Deal) private _deals;

    event Funded(bytes32 indexed batchId, address indexed buyer, address supplier, address token, uint256 amount);
    event Released(bytes32 indexed batchId, address indexed supplier, uint256 amount);
    event Disputed(bytes32 indexed batchId, uint16 score);
    event Refunded(bytes32 indexed batchId, address indexed buyer, uint256 amount);
    event PassThresholdUpdated(uint16 oldT, uint16 newT);

    error DealExists(bytes32 batchId);
    error NotFunded(bytes32 batchId);
    error ZeroAmount();
    error AlreadySettled(bytes32 batchId);
    error NotAttested(bytes32 batchId);
    error UnknownBatch(bytes32 batchId);
    error SupplierMismatch(bytes32 batchId);
    error NotDisputed(bytes32 batchId);
    error ZeroAddress();
    error InvalidThreshold(uint16 threshold);

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
    function setPassThreshold(uint16 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newThreshold == 0 || newThreshold > MAX_BPS) revert InvalidThreshold(newThreshold);
        uint16 old = passThreshold;
        passThreshold = newThreshold;
        emit PassThresholdUpdated(old, newThreshold);
    }

    /// @notice Pause fund/settle/refund. Admin only.
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
    /// @dev Passing score -> release to supplier; failing score -> mark Disputed (no auto-refund).
    function settle(bytes32 batchId) external nonReentrant whenNotPaused {
        Deal storage deal = _deals[batchId];
        if (deal.state == DealState.None) revert NotFunded(batchId);
        if (deal.state != DealState.Funded) revert AlreadySettled(batchId);
        if (!attestations.isAttested(batchId)) revert NotAttested(batchId);

        uint16 score = attestations.scoreOf(batchId);

        if (score >= passThreshold) {
            deal.state = DealState.Released;
            IERC20(deal.token).safeTransfer(deal.supplier, deal.amount);
            emit Released(batchId, deal.supplier, deal.amount);
        } else {
            deal.state = DealState.Disputed;
            emit Disputed(batchId, score);
        }
    }

    /// @notice Refund a disputed deal back to the buyer. Admin (dispute resolver) only.
    function refund(bytes32 batchId) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        Deal storage deal = _deals[batchId];
        if (deal.state != DealState.Disputed) revert NotDisputed(batchId);

        deal.state = DealState.Refunded;
        IERC20(deal.token).safeTransfer(deal.buyer, deal.amount);
        emit Refunded(batchId, deal.buyer, deal.amount);
    }

    /// @notice Fetch a deal by batch id.
    function getDeal(bytes32 batchId) external view returns (Deal memory) {
        return _deals[batchId];
    }
}
