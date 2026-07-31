// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { IListingRegistry } from "../interfaces/IListingRegistry.sol";

/// @title ListingRegistry
/// @notice Generic listing book for tradable assets — receivables, ERC721 titles (InvoiceNFT,
///         WarehouseReceipt, BatchNFT), and ERC1155 units (carbon credits). It is a lightweight
///         index only: it never custodies assets or funds. Sellers publish listings and cancel
///         their own; authorised market contracts (holders of {MARKET_ROLE}) flip a listing to
///         `Filled` once they have executed the trade and moved the assets themselves.
/// @dev Peers resolve this via the {AddressBook}. Inherits {IListingRegistry} so its events, errors,
///      enums, and struct come straight from the shared interface. Every state change emits an event
///      for the off-chain indexer.
contract ListingRegistry is ProofChainAccess, IListingRegistry {
    /// @notice Role granted to trusted market contracts (AuctionHouse, OrderBook, FinancingMarketplace)
    ///         permitted to mark listings as filled once they settle a trade.
    bytes32 public constant MARKET_ROLE = keccak256("MARKET_ROLE");

    /// @dev Monotonic id counter; the first listing is id 1 so 0 is an unambiguous "none".
    uint256 private _nextListingId = 1;

    /// @dev listingId => Listing record.
    mapping(uint256 => Listing) private _listings;

    /// @notice Thrown when a listing is created with the sentinel {AssetKind.Unknown} kind.
    error InvalidKind();

    /// @notice Thrown when a fungible listing is created with a zero unit amount.
    error ZeroAmount();

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IListingRegistry
    /// @dev Seller is always `msg.sender`; the caller must separately grant approval to whatever
    ///      market contract will execute the trade. Validates asset kind, address, amount, and price.
    function createListing(
        AssetKind kind,
        address asset,
        uint256 assetId,
        uint256 amount,
        address paymentToken,
        uint256 price
    ) external override returns (uint256 listingId) {
        _requireNotGloballyPaused();
        if (kind == AssetKind.Unknown) revert InvalidKind();
        if (asset == address(0) || paymentToken == address(0)) revert ZeroAddress();
        if (price == 0) revert ZeroPrice();
        // Fungible listings (receivable share / ERC1155 units) must carry a positive amount; a
        // single ERC721 title is implicitly quantity 1.
        uint256 normalizedAmount = kind == AssetKind.ERC721 ? 1 : amount;
        if (normalizedAmount == 0) revert ZeroAmount();

        listingId = _nextListingId++;
        _listings[listingId] = Listing({
            listingId: listingId,
            kind: kind,
            asset: asset,
            assetId: assetId,
            amount: normalizedAmount,
            seller: msg.sender,
            paymentToken: paymentToken,
            price: price,
            status: ListingStatus.Active
        });

        emit ListingCreated(listingId, msg.sender, kind, asset, assetId, price);
    }

    /// @inheritdoc IListingRegistry
    function cancelListing(uint256 listingId) external override {
        Listing storage listing = _listings[listingId];
        if (listing.status == ListingStatus.None) revert UnknownListing(listingId);
        if (listing.seller != msg.sender) revert NotSeller(listingId);
        if (listing.status != ListingStatus.Active) revert NotActive(listingId);

        listing.status = ListingStatus.Cancelled;
        emit ListingCancelled(listingId);
    }

    /// @inheritdoc IListingRegistry
    /// @dev Restricted to {MARKET_ROLE}: only a trusted market contract that actually executed the
    ///      trade may retire the listing. Idempotency is enforced — a filled/cancelled listing reverts.
    function markFilled(uint256 listingId, address buyer) external override onlyRole(MARKET_ROLE) {
        if (buyer == address(0)) revert ZeroAddress();
        Listing storage listing = _listings[listingId];
        if (listing.status == ListingStatus.None) revert UnknownListing(listingId);
        if (listing.status != ListingStatus.Active) revert NotActive(listingId);

        listing.status = ListingStatus.Filled;
        emit ListingFilled(listingId, buyer);
    }

    /// @inheritdoc IListingRegistry
    function listingOf(uint256 listingId) external view override returns (Listing memory) {
        Listing memory listing = _listings[listingId];
        if (listing.status == ListingStatus.None) revert UnknownListing(listingId);
        return listing;
    }

    /// @notice Total number of listings ever created (ids run 1..totalListings).
    function totalListings() external view returns (uint256) {
        return _nextListingId - 1;
    }
}
