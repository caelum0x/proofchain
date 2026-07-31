// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IListingRegistry
/// @notice Generic listings for receivables, NFTs, and carbon credits.
interface IListingRegistry {
    enum AssetKind {
        Unknown,
        Receivable,
        ERC721,
        ERC1155
    }

    enum ListingStatus {
        None,
        Active,
        Cancelled,
        Filled
    }

    struct Listing {
        uint256 listingId;
        AssetKind kind;
        address asset;
        uint256 assetId;
        uint256 amount;
        address seller;
        address paymentToken;
        uint256 price;
        ListingStatus status;
    }

    event ListingCreated(
        uint256 indexed listingId, address indexed seller, AssetKind kind, address asset, uint256 assetId, uint256 price
    );
    event ListingCancelled(uint256 indexed listingId);
    event ListingFilled(uint256 indexed listingId, address indexed buyer);

    error UnknownListing(uint256 listingId);
    error NotSeller(uint256 listingId);
    error NotActive(uint256 listingId);
    error ZeroPrice();

    /// @notice Create a listing; returns its id.
    function createListing(
        AssetKind kind,
        address asset,
        uint256 assetId,
        uint256 amount,
        address paymentToken,
        uint256 price
    ) external returns (uint256 listingId);

    /// @notice Cancel an active listing you own.
    function cancelListing(uint256 listingId) external;

    /// @notice Mark a listing filled. Authorized market contracts only.
    function markFilled(uint256 listingId, address buyer) external;

    function listingOf(uint256 listingId) external view returns (Listing memory);
}
