// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IInvoiceFinancing } from "../interfaces/IInvoiceFinancing.sol";
import { ISettlementEscrow } from "../interfaces/ISettlementEscrow.sol";
import { IAttestationRegistry } from "../interfaces/IAttestationRegistry.sol";
import { IScoreOracle } from "../interfaces/IScoreOracle.sol";
import { IDiscountCalculator } from "../interfaces/IDiscountCalculator.sol";
import { IReceivableRegistry } from "../interfaces/IReceivableRegistry.sol";
import { IInvoiceNFT } from "../interfaces/IInvoiceNFT.sol";

/// @title InvoiceFinancing
/// @notice Marketplace primitive for invoice factoring. A supplier lists an attested, escrow-funded
///         receivable; a lender advances `askAmount` up front and, by having been assigned the
///         escrow payout, is repaid — with a risk/tenor-based yield — when the buyer's payment is
///         released. Any surplus over the lender's entitlement flows back to the supplier.
/// @dev Peers are resolved via the {AddressBook}. Money movement uses {SafeERC20} and every
///      fund-moving external is `nonReentrant`. The escrow payout MUST already be assigned to this
///      contract (`SettlementEscrow.setPayee`, supplier-only) before a lender funds, guaranteeing
///      the released proceeds land here for {claim} to split.
contract InvoiceFinancing is ProofChainAccess, ReentrancyGuard, IInvoiceFinancing {
    using SafeERC20 for IERC20;

    uint16 private constant BPS = 10_000;

    mapping(bytes32 => Listing) private _listings;

    /// @notice The escrow payout for this batch is not assigned to this contract.
    error PayeeNotAssigned(bytes32 batchId);
    /// @notice The escrow deal has not been released yet, so there are no proceeds to claim.
    error NotReleased(bytes32 batchId);
    /// @notice The listing was already claimed.
    error AlreadyClaimed(bytes32 batchId);
    /// @notice The requested advance exceeds the receivable's collectible face value.
    error AskExceedsFace(bytes32 batchId);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    // --------------------------------------------------------------------- listing

    /// @inheritdoc IInvoiceFinancing
    function list(bytes32 batchId, uint256 askAmount) external {
        if (askAmount == 0) revert ZeroAmount();
        if (_listings[batchId].state != ListingState.None) revert ListingExists(batchId);

        ISettlementEscrow.Deal memory deal = _escrow().getDeal(batchId);
        if (deal.state != ISettlementEscrow.DealState.Funded) revert NotFunded(batchId);
        if (msg.sender != deal.supplier) revert NotSupplier(batchId);
        if (!_attestations().isAttested(batchId)) revert NotAttested(batchId);
        if (askAmount > deal.amount) revert AskExceedsFace(batchId);

        _listings[batchId] = Listing({
            batchId: batchId,
            supplier: deal.supplier,
            lender: address(0),
            token: deal.token,
            askAmount: askAmount,
            state: ListingState.Listed
        });

        emit Listed(batchId, deal.supplier, deal.token, askAmount);
    }

    /// @inheritdoc IInvoiceFinancing
    function fund(bytes32 batchId) external nonReentrant {
        Listing storage listing = _listings[batchId];
        if (listing.state == ListingState.None) revert UnknownListing(batchId);
        if (listing.state != ListingState.Listed) revert AlreadyFunded(batchId);

        ISettlementEscrow escrow = _escrow();
        // The supplier must have assigned the payout to this contract so the released proceeds
        // land here for repayment — this protects the lender.
        if (escrow.payeeOverride(batchId) != address(this)) revert PayeeNotAssigned(batchId);

        // Deal must still be open (funded, not yet settled/disputed).
        ISettlementEscrow.Deal memory deal = escrow.getDeal(batchId);
        if (deal.state != ISettlementEscrow.DealState.Funded) revert NotFunded(batchId);

        listing.lender = msg.sender;
        listing.state = ListingState.Funded;

        // Advance the ask amount from the lender straight to the supplier.
        IERC20(listing.token).safeTransferFrom(msg.sender, listing.supplier, listing.askAmount);

        // Best-effort assignment of the receivable NFT title to the lender (never blocks funding).
        _tryTransferReceivable(batchId, listing.supplier, msg.sender);

        emit Funded(batchId, msg.sender, listing.askAmount);
    }

    /// @inheritdoc IInvoiceFinancing
    function claim(bytes32 batchId) external nonReentrant {
        Listing storage listing = _listings[batchId];
        if (listing.state == ListingState.None) revert UnknownListing(batchId);
        if (listing.state == ListingState.Claimed) revert AlreadyClaimed(batchId);
        if (listing.state != ListingState.Funded) revert NotFunded(batchId);

        ISettlementEscrow.Deal memory deal = _escrow().getDeal(batchId);
        if (deal.state != ISettlementEscrow.DealState.Released) revert NotReleased(batchId);

        (uint256 lenderTake, uint256 remainder) = _split(listing, deal.amount);

        // Effects before interactions.
        listing.state = ListingState.Claimed;

        IERC20 token = IERC20(listing.token);
        if (lenderTake > 0) token.safeTransfer(listing.lender, lenderTake);
        if (remainder > 0) token.safeTransfer(listing.supplier, remainder);

        emit Claimed(batchId, listing.lender, lenderTake, remainder);
    }

    /// @inheritdoc IInvoiceFinancing
    function cancel(bytes32 batchId) external {
        Listing storage listing = _listings[batchId];
        if (listing.state == ListingState.None) revert UnknownListing(batchId);
        if (listing.state != ListingState.Listed) revert AlreadyFunded(batchId);
        if (msg.sender != listing.supplier) revert NotSupplier(batchId);

        listing.state = ListingState.Cancelled;
        emit Cancelled(batchId);
    }

    // --------------------------------------------------------------------- views

    /// @inheritdoc IInvoiceFinancing
    function listingOf(bytes32 batchId) external view returns (Listing memory) {
        return _listings[batchId];
    }

    /// @notice Preview the repayment split for a funded, released batch (lender take, supplier
    ///         remainder). Returns (0, 0) when the batch is not in a claimable state.
    function quoteClaim(bytes32 batchId) external view returns (uint256 lenderTake, uint256 remainder) {
        Listing memory listing = _listings[batchId];
        if (listing.state != ListingState.Funded) return (0, 0);
        ISettlementEscrow.Deal memory deal = _escrow().getDeal(batchId);
        if (deal.state != ISettlementEscrow.DealState.Released) return (0, 0);
        return _split(listing, deal.amount);
    }

    // --------------------------------------------------------------------- internal

    /// @dev Split released proceeds `face` between the lender (principal + risk/tenor yield) and the
    ///      supplier (surplus). Falls back to principal-only when pricing oracles are unavailable.
    function _split(Listing memory listing, uint256 face)
        internal
        view
        returns (uint256 lenderTake, uint256 remainder)
    {
        uint256 ask = listing.askAmount;
        if (ask >= face) {
            // Lender is owed at least the face; they take everything, nothing left for supplier.
            return (face, 0);
        }

        uint256 entitlement = _lenderEntitlement(listing.batchId, listing.supplier, ask);
        if (entitlement < ask) entitlement = ask; // never below principal
        if (entitlement > face) entitlement = face; // never above what was collected

        return (entitlement, face - entitlement);
    }

    /// @dev Gross the lender's principal up by the risk/tenor discount to yield their entitlement.
    ///      entitlement = ask / (1 - discount). Returns `ask` (principal only) if pricing fails, so
    ///      the split degrades gracefully to principal-first repayment when oracles are unset.
    function _lenderEntitlement(bytes32 batchId, address supplier, uint256 ask)
        internal
        view
        returns (uint256)
    {
        address oracle = _addrOrZero(Keys.SCORE_ORACLE);
        address calc = _addrOrZero(Keys.DISCOUNT_CALCULATOR);
        if (oracle == address(0) || calc == address(0)) return ask;

        uint8 grade;
        try IScoreOracle(oracle).gradeOf(supplier) returns (uint8 g) {
            grade = g;
        } catch {
            return ask;
        }
        if (grade == 0) return ask;

        uint256 tenorDays = _tenorDays(batchId);

        try IDiscountCalculator(calc).discountBps(grade, tenorDays) returns (uint16 d) {
            if (d == 0 || d >= BPS) return ask;
            return (ask * BPS) / (BPS - d);
        } catch {
            return ask;
        }
    }

    /// @dev Days until the receivable is due, read from {ReceivableRegistry}; 0 when no terms exist
    ///      or the due date has passed.
    function _tenorDays(bytes32 batchId) internal view returns (uint256) {
        address reg = _addrOrZero(Keys.RECEIVABLE_REGISTRY);
        if (reg == address(0)) return 0;
        try IReceivableRegistry(reg).termsOf(batchId) returns (IReceivableRegistry.Terms memory t) {
            if (t.dueDate <= block.timestamp) return 0;
            return (uint256(t.dueDate) - block.timestamp) / 1 days;
        } catch {
            return 0;
        }
    }

    /// @dev Best-effort transfer of the receivable NFT from supplier to lender. Never reverts.
    function _tryTransferReceivable(bytes32 batchId, address from, address to) internal {
        address nft = _addrOrZero(Keys.INVOICE_NFT);
        if (nft == address(0)) return;
        uint256 tokenId = uint256(batchId);
        try IInvoiceNFT(nft).safeTransferFrom(from, to, tokenId) { } catch { }
    }

    function _escrow() internal view returns (ISettlementEscrow) {
        return ISettlementEscrow(_addr(Keys.SETTLEMENT_ESCROW));
    }

    function _attestations() internal view returns (IAttestationRegistry) {
        return IAttestationRegistry(_addr(Keys.ATTESTATION_REGISTRY));
    }
}
