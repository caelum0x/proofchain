// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { ISupplyChainFinance } from "../interfaces/ISupplyChainFinance.sol";
import { IAttestationRegistry } from "../interfaces/IAttestationRegistry.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title SupplyChainFinance
/// @notice Reverse factoring / approved-payables finance. An anchor buyer creates a funded program;
///         AI-attested supplier invoices approved under it can be drawn early from the funder at the
///         program discount, and the buyer repays the funder in full at each invoice due date.
/// @dev Early payment pulls from the funder to the supplier; settlement pulls the full amount from
///      the anchor buyer to the funder. {SafeERC20} + `nonReentrant`. Program utilization is tracked
///      against `fundingLimit` and freed on settlement. Peers via {AddressBook}.
contract SupplyChainFinance is ProofChainAccess, ReentrancyGuard, ISupplyChainFinance {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    mapping(bytes32 => Program) private _programs;
    mapping(bytes32 => ProgramInvoice) private _invoices;

    /// @notice A settlement token outside the {StablecoinRegistry} allowlist was supplied.
    error TokenNotAccepted(address token);
    /// @notice A discount rate of 100% or more was supplied.
    error InvalidDiscount(uint16 discountBps);
    /// @notice The invoice's due date has not yet passed.
    error NotYetDue(bytes32 invoiceId, uint64 dueDate);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc ISupplyChainFinance
    function createProgram(bytes32 programId, address funder, address token, uint16 discountBps, uint256 fundingLimit)
        external
    {
        _requireNotGloballyPaused();
        if (_programExists(programId)) revert ProgramExists(programId);
        if (funder == address(0) || token == address(0)) revert ZeroAddress();
        if (fundingLimit == 0) revert ZeroAmount();
        if (discountBps >= BPS) revert InvalidDiscount(discountBps);
        _requireAccepted(token);

        _programs[programId] = Program({
            programId: programId,
            anchorBuyer: msg.sender,
            funder: funder,
            token: token,
            discountBps: discountBps,
            fundingLimit: fundingLimit,
            utilized: 0,
            active: true
        });

        emit ProgramCreated(programId, msg.sender, funder, token, fundingLimit);
    }

    /// @inheritdoc ISupplyChainFinance
    function updateProgram(bytes32 programId, uint16 discountBps, uint256 fundingLimit, bool active) external {
        Program storage prog = _programs[programId];
        if (!_programExists(programId)) revert UnknownProgram(programId);
        if (msg.sender != prog.anchorBuyer) revert NotAnchorBuyer(programId);
        if (discountBps >= BPS) revert InvalidDiscount(discountBps);

        prog.discountBps = discountBps;
        prog.fundingLimit = fundingLimit;
        prog.active = active;

        emit ProgramUpdated(programId, discountBps, fundingLimit, active);
    }

    /// @inheritdoc ISupplyChainFinance
    function approveInvoice(
        bytes32 invoiceId,
        bytes32 programId,
        bytes32 batchId,
        address supplier,
        uint256 amount,
        uint64 dueDate
    ) external {
        Program storage prog = _programs[programId];
        if (!_programExists(programId)) revert UnknownProgram(programId);
        if (msg.sender != prog.anchorBuyer) revert NotAnchorBuyer(programId);
        if (!prog.active) revert ProgramInactive(programId);
        if (_invoices[invoiceId].state != InvoiceState.None) revert InvoiceExists(invoiceId);
        if (amount == 0) revert ZeroAmount();
        if (supplier == address(0)) revert ZeroAddress();
        // Approved payables must reference an AI-verified batch attestation.
        if (!IAttestationRegistry(_addr(Keys.ATTESTATION_REGISTRY)).isAttested(batchId)) revert NotAttested(batchId);

        _invoices[invoiceId] = ProgramInvoice({
            invoiceId: invoiceId,
            programId: programId,
            batchId: batchId,
            supplier: supplier,
            amount: amount,
            dueDate: dueDate,
            state: InvoiceState.Approved
        });

        emit InvoiceApproved(invoiceId, programId, supplier, amount, dueDate);
    }

    /// @inheritdoc ISupplyChainFinance
    function drawEarlyPayment(bytes32 invoiceId) external nonReentrant {
        ProgramInvoice storage inv = _invoices[invoiceId];
        _requireInvoiceExists(inv, invoiceId);
        if (inv.state != InvoiceState.Approved) revert InvalidState(invoiceId, InvoiceState.Approved, inv.state);
        if (msg.sender != inv.supplier) revert NotSupplier(invoiceId);

        Program storage prog = _programs[inv.programId];
        if (!prog.active) revert ProgramInactive(inv.programId);

        uint256 available = prog.fundingLimit - prog.utilized;
        if (inv.amount > available) revert LimitExceeded(inv.amount, available);

        uint256 discount = (inv.amount * prog.discountBps) / BPS;
        uint256 paidAmount = inv.amount - discount;

        prog.utilized += inv.amount;
        inv.state = InvoiceState.EarlyPaid;

        // The funder advances the discounted amount to the supplier.
        IERC20(prog.token).safeTransferFrom(prog.funder, inv.supplier, paidAmount);
        emit EarlyPaid(invoiceId, inv.supplier, paidAmount, discount);
    }

    /// @inheritdoc ISupplyChainFinance
    function settle(bytes32 invoiceId) external nonReentrant {
        ProgramInvoice storage inv = _invoices[invoiceId];
        _requireInvoiceExists(inv, invoiceId);
        if (inv.state != InvoiceState.EarlyPaid) revert InvalidState(invoiceId, InvoiceState.EarlyPaid, inv.state);

        Program storage prog = _programs[inv.programId];
        if (msg.sender != prog.anchorBuyer) revert NotAnchorBuyer(inv.programId);

        // Free the utilized headroom now that the payable is being repaid.
        if (prog.utilized >= inv.amount) {
            prog.utilized -= inv.amount;
        } else {
            prog.utilized = 0;
        }
        inv.state = InvoiceState.Settled;

        // The anchor buyer repays the funder in full at maturity.
        IERC20(prog.token).safeTransferFrom(prog.anchorBuyer, prog.funder, inv.amount);
        emit Settled(invoiceId, inv.amount);
    }

    /// @inheritdoc ISupplyChainFinance
    function markOverdue(bytes32 invoiceId) external {
        ProgramInvoice storage inv = _invoices[invoiceId];
        _requireInvoiceExists(inv, invoiceId);
        if (inv.state != InvoiceState.Approved && inv.state != InvoiceState.EarlyPaid) {
            revert InvalidState(invoiceId, InvoiceState.EarlyPaid, inv.state);
        }
        if (block.timestamp < inv.dueDate) revert NotYetDue(invoiceId, inv.dueDate);

        inv.state = InvoiceState.Overdue;
        emit MarkedOverdue(invoiceId);
    }

    /// @inheritdoc ISupplyChainFinance
    function programOf(bytes32 programId) external view returns (Program memory) {
        return _programs[programId];
    }

    /// @inheritdoc ISupplyChainFinance
    function invoiceOf(bytes32 invoiceId) external view returns (ProgramInvoice memory) {
        return _invoices[invoiceId];
    }

    function _programExists(bytes32 programId) private view returns (bool) {
        return _programs[programId].anchorBuyer != address(0);
    }

    function _requireInvoiceExists(ProgramInvoice storage inv, bytes32 invoiceId) private view {
        if (inv.state == InvoiceState.None) revert UnknownInvoice(invoiceId);
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
