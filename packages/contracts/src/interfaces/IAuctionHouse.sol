// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IAuctionHouse
/// @notice English auctions for InvoiceNFT / WarehouseReceipt tokens.
/// @dev deps (AddressBook): BidManager (bid escrow).
interface IAuctionHouse {
    enum AuctionState {
        None,
        Active,
        Settled,
        Cancelled
    }

    struct Auction {
        uint256 auctionId;
        address nft;
        uint256 tokenId;
        address seller;
        address paymentToken;
        uint256 reservePrice;
        uint256 highestBid;
        address highestBidder;
        uint64 endTime;
        AuctionState state;
    }

    event AuctionStarted(
        uint256 indexed auctionId, address indexed nft, uint256 indexed tokenId, address seller, uint64 endTime
    );
    event Bid(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event Settled(uint256 indexed auctionId, address indexed winner, uint256 amount);

    error UnknownAuction(uint256 auctionId);
    error AuctionNotActive(uint256 auctionId);
    error AuctionEnded(uint256 auctionId);
    error AuctionOngoing(uint256 auctionId);
    error BidTooLow(uint256 auctionId, uint256 bid, uint256 required);

    /// @notice Start an auction for an NFT the caller owns.
    function startAuction(
        address nft,
        uint256 tokenId,
        address paymentToken,
        uint256 reservePrice,
        uint64 duration
    ) external returns (uint256 auctionId);

    /// @notice Place a bid on an active auction.
    function bid(uint256 auctionId, uint256 amount) external;

    /// @notice Settle a finished auction: transfer NFT to winner, funds to seller.
    function settleAuction(uint256 auctionId) external;

    function auctionOf(uint256 auctionId) external view returns (Auction memory);
}
