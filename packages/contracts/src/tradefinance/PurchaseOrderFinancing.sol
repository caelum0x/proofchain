// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IPurchaseOrderFinancing } from "../interfaces/IPurchaseOrderFinancing.sol";
import { IAttestationRegistry } from "../interfaces/IAttestationRegistry.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title PurchaseOrderFinancing
/// @notice Pre-shipment working-capital finance. A supplier registers a confirmed buyer PO; a
///         financier advances up to the PO value to fund production. On AI-attested delivery the
///         buyer's payment repays the advance plus fee, with any surplus flowing to the supplier.
/// @dev Fund movement via {SafeERC20} and `nonReentrant`. `finance` advances from the financier to
///      the supplier; `repay` pulls the PO value from the buyer and splits it. Peers via {AddressBook}.
contract PurchaseOrderFinancing is ProofChainAccess, ReentrancyGuard, IPurchaseOrderFinancing {
    using SafeERC20 for IERC20;

    uint16 private constant BPS = 10_000;

    mapping(bytes32 => PO) private _pos;

    /// @notice A settlement token outside the {StablecoinRegistry} allowlist was supplied.
    error TokenNotAccepted(address token);
    /// @notice Default was asserted before the PO due date.
    error NotYetDue(bytes32 poId, uint64 dueDate);
    /// @notice A fee rate of 100% or more was supplied.
    error InvalidFee(uint16 feeBps);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IPurchaseOrderFinancing
    function register(bytes32 poId, bytes32 batchId, address buyer, address token, uint256 poValue, uint64 dueDate)
        external
    {
        _requireNotGloballyPaused();
        if (_pos[poId].state != POState.None) revert POExists(poId);
        if (poValue == 0) revert ZeroAmount();
        if (buyer == address(0) || token == address(0)) revert ZeroAddress();
        _requireAccepted(token);

        _pos[poId] = PO({
            poId: poId,
            batchId: batchId,
            supplier: msg.sender,
            buyer: buyer,
            financier: address(0),
            token: token,
            poValue: poValue,
            advance: 0,
            feeBps: 0,
            dueDate: dueDate,
            state: POState.Registered
        });

        emit Registered(poId, batchId, msg.sender, buyer, poValue);
    }

    /// @inheritdoc IPurchaseOrderFinancing
    function finance(bytes32 poId, uint256 advance, uint16 feeBps) external nonReentrant {
        PO storage p = _pos[poId];
        _requireExists(p, poId);
        if (p.state != POState.Registered) revert InvalidState(poId, POState.Registered, p.state);
        if (advance == 0) revert ZeroAmount();
        if (advance > p.poValue) revert AdvanceExceedsValue(advance, p.poValue);
        if (feeBps >= BPS) revert InvalidFee(feeBps);

        p.financier = msg.sender;
        p.advance = advance;
        p.feeBps = feeBps;
        p.state = POState.Financed;

        // Advance working capital from the financier to the supplier to fund production.
        IERC20(p.token).safeTransferFrom(msg.sender, p.supplier, advance);
        emit Financed(poId, msg.sender, advance, feeBps);
    }

    /// @inheritdoc IPurchaseOrderFinancing
    function markDelivered(bytes32 poId) external {
        PO storage p = _pos[poId];
        _requireExists(p, poId);
        if (p.state != POState.Financed) revert InvalidState(poId, POState.Financed, p.state);
        if (msg.sender != p.supplier && msg.sender != p.financier) revert NotSupplier(poId);
        // Delivery is only recognised against an AI-verified batch attestation.
        if (!IAttestationRegistry(_addr(Keys.ATTESTATION_REGISTRY)).isAttested(p.batchId)) revert NotAttested(p.batchId);

        p.state = POState.Delivered;
        emit Delivered(poId, p.batchId);
    }

    /// @inheritdoc IPurchaseOrderFinancing
    function repay(bytes32 poId) external nonReentrant {
        PO storage p = _pos[poId];
        _requireExists(p, poId);
        if (p.state != POState.Delivered) revert InvalidState(poId, POState.Delivered, p.state);

        uint256 principal = p.advance;
        uint256 fee = (principal * p.feeBps) / BPS;
        uint256 financierTake = principal + fee;
        uint256 poValue = p.poValue;
        if (financierTake > poValue) financierTake = poValue;
        uint256 surplus = poValue - financierTake;

        p.state = POState.Repaid;

        IERC20 token = IERC20(p.token);
        // The buyer settles the full PO value; the financier is repaid first, surplus to supplier.
        token.safeTransferFrom(p.buyer, address(this), poValue);
        if (financierTake > 0) token.safeTransfer(p.financier, financierTake);
        if (surplus > 0) token.safeTransfer(p.supplier, surplus);

        emit Repaid(poId, principal, fee, surplus);
    }

    /// @inheritdoc IPurchaseOrderFinancing
    function markDefault(bytes32 poId) external {
        PO storage p = _pos[poId];
        _requireExists(p, poId);
        if (p.state != POState.Financed && p.state != POState.Delivered) {
            revert InvalidState(poId, POState.Financed, p.state);
        }
        if (msg.sender != p.financier) revert NotFinancier(poId);
        if (block.timestamp < p.dueDate) revert NotYetDue(poId, p.dueDate);

        p.state = POState.Defaulted;
        emit Defaulted(poId);
    }

    /// @inheritdoc IPurchaseOrderFinancing
    function cancel(bytes32 poId) external {
        PO storage p = _pos[poId];
        _requireExists(p, poId);
        if (p.state != POState.Registered) revert InvalidState(poId, POState.Registered, p.state);
        if (msg.sender != p.supplier) revert NotSupplier(poId);

        p.state = POState.Cancelled;
        emit Cancelled(poId);
    }

    /// @inheritdoc IPurchaseOrderFinancing
    function poOf(bytes32 poId) external view returns (PO memory) {
        return _pos[poId];
    }

    function _requireExists(PO storage p, bytes32 poId) private view {
        if (p.state == POState.None) revert UnknownPO(poId);
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
