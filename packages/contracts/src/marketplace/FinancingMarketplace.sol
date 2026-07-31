// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IFinancingMarketplace } from "../interfaces/IFinancingMarketplace.sol";
import { IInvoiceFinancing } from "../interfaces/IInvoiceFinancing.sol";

/// @title FinancingMarketplace
/// @notice A competitive order book for receivable financing. Lenders publish standing offers that
///         escrow their committed capital against a specific attested receivable (`batchId`); the
///         receivable's supplier accepts the best offer, which advances the lender's escrowed funds to
///         them. Unaccepted offers are fully refundable by the lender at any time.
/// @dev The {InvoiceFinancing} peer is resolved through the {AddressBook} and used only via its
///      interface to validate that the receivable is genuinely listed for financing, in the expected
///      settlement token, and to authenticate the accepting supplier. Every fund-moving external is
///      `nonReentrant` and uses `SafeERC20`; escrowed amounts are measured from balance deltas so
///      fee-on-transfer tokens cannot over-credit an offer.
contract FinancingMarketplace is ProofChainAccess, ReentrancyGuard, IFinancingMarketplace {
    using SafeERC20 for IERC20;

    /// @dev Monotonic id counter; first offer is id 1 so 0 is an unambiguous "none".
    uint256 private _nextOfferId = 1;

    /// @dev offerId => Offer record.
    mapping(uint256 => Offer) private _offers;

    /// @notice Thrown when an offer references a receivable that is not currently listed for financing.
    error ReceivableNotListed(bytes32 batchId);

    /// @notice Thrown when the offer token does not match the receivable's settlement token.
    error TokenMismatch(bytes32 batchId, address expected, address provided);

    /// @notice Thrown when someone other than the receivable's supplier tries to accept an offer.
    error NotReceivableSupplier(uint256 offerId);

    /// @param addressBook_ Deployed {AddressBook} used to resolve {InvoiceFinancing}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IFinancingMarketplace
    /// @dev The maker (lender) commits `amount` of `token` to finance `batchId`; the funds are pulled
    ///      into escrow immediately. The receivable must currently be `Listed` in {InvoiceFinancing}
    ///      and denominated in `token`.
    function makeOffer(bytes32 batchId, address token, uint256 amount)
        external
        override
        nonReentrant
        returns (uint256 offerId)
    {
        _requireNotGloballyPaused();
        if (amount == 0) revert ZeroAmount();
        if (token == address(0)) revert ZeroAddress();

        IInvoiceFinancing.Listing memory listing = _requireListed(batchId);
        if (listing.token != token) revert TokenMismatch(batchId, listing.token, token);

        // Escrow the lender's committed capital (fee-on-transfer safe via balance delta).
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        offerId = _nextOfferId++;
        _offers[offerId] = Offer({
            offerId: offerId,
            batchId: batchId,
            maker: msg.sender,
            token: token,
            amount: received,
            taken: false,
            cancelled: false
        });

        emit OfferMade(offerId, batchId, msg.sender, received);
    }

    /// @inheritdoc IFinancingMarketplace
    /// @dev Only the receivable's supplier (per {InvoiceFinancing}) may accept, and only while the
    ///      receivable is still `Listed`. The escrowed capital is advanced to the supplier.
    function takeOffer(uint256 offerId) external override nonReentrant {
        Offer storage offer = _get(offerId);
        _requireOpen(offer);

        IInvoiceFinancing.Listing memory listing = _requireListed(offer.batchId);
        if (msg.sender != listing.supplier) revert NotReceivableSupplier(offerId);

        // Effects before interaction.
        offer.taken = true;
        uint256 amount = offer.amount;

        // Advance the lender's escrowed capital to the supplier.
        IERC20(offer.token).safeTransfer(msg.sender, amount);

        emit OfferTaken(offerId, msg.sender);
    }

    /// @inheritdoc IFinancingMarketplace
    /// @dev The maker reclaims their full escrowed capital from an offer that has not been accepted.
    function cancelOffer(uint256 offerId) external override nonReentrant {
        Offer storage offer = _get(offerId);
        if (offer.maker != msg.sender) revert NotMaker(offerId);
        _requireOpen(offer);

        offer.cancelled = true;
        IERC20(offer.token).safeTransfer(offer.maker, offer.amount);

        emit OfferCancelled(offerId);
    }

    /// @inheritdoc IFinancingMarketplace
    function offerOf(uint256 offerId) external view override returns (Offer memory) {
        return _get(offerId);
    }

    /// @notice Total number of offers ever made (ids run 1..totalOffers).
    function totalOffers() external view returns (uint256) {
        return _nextOfferId - 1;
    }

    /// @dev Load an offer by id, reverting {UnknownOffer} if it was never created.
    function _get(uint256 offerId) private view returns (Offer storage) {
        if (offerId == 0 || offerId >= _nextOfferId) revert UnknownOffer(offerId);
        return _offers[offerId];
    }

    /// @dev Revert {OfferClosed} if an offer has been taken or cancelled.
    function _requireOpen(Offer storage offer) private view {
        if (offer.taken || offer.cancelled) revert OfferClosed(offer.offerId);
    }

    /// @dev Resolve the {InvoiceFinancing} listing for `batchId`, reverting unless it is `Listed`.
    function _requireListed(bytes32 batchId) private view returns (IInvoiceFinancing.Listing memory listing) {
        IInvoiceFinancing financing = IInvoiceFinancing(_addr(Keys.INVOICE_FINANCING));
        listing = financing.listingOf(batchId);
        if (listing.state != IInvoiceFinancing.ListingState.Listed) revert ReceivableNotListed(batchId);
    }
}
