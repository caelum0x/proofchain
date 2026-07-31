// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC721Holder } from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IAuctionHouse } from "../interfaces/IAuctionHouse.sol";
import { IBidManager } from "../interfaces/IBidManager.sol";

/// @notice The shared {IBidManager} surface plus the `settleBid` payout leg the {BidManager}
///         implementation adds for auction close. Declared here so the AuctionHouse resolves the
///         escrow vault through an interface (never its implementation) while still reaching the
///         settlement payout.
interface IBidManagerSettle is IBidManager {
    /// @notice Release a winning bidder's escrow to a recipient (the seller). MARKET_ROLE only.
    function settleBid(uint256 auctionId, address bidder, address to) external returns (uint256 amount);
}

/// @title AuctionHouse
/// @notice English (ascending) auctions for ProofChain ERC721 titles — InvoiceNFT, WarehouseReceipt,
///         BatchNFT. The seller escrows the NFT here; bidders place strictly-increasing bids whose
///         funds are custodied in the {BidManager}. Out-bid bidders are refunded immediately; when
///         the clock runs out anyone may settle, transferring the NFT to the winner and the winning
///         funds to the seller. If no bid clears the reserve, the NFT returns to the seller.
/// @dev The {BidManager} is resolved via the {AddressBook} and used strictly through its interface
///      (plus its `settleBid` payout). AuctionHouse must hold {BidManager.MARKET_ROLE}. Every
///      fund/NFT-moving external is `nonReentrant`; the contract custodies NFTs via {ERC721Holder}.
contract AuctionHouse is ProofChainAccess, ReentrancyGuard, ERC721Holder, IAuctionHouse {
    /// @dev Monotonic id counter; first auction is id 1 so 0 is an unambiguous "none".
    uint256 private _nextAuctionId = 1;

    /// @dev auctionId => Auction record.
    mapping(uint256 => Auction) private _auctions;

    /// @notice Thrown when an auction is started with a zero duration.
    error ZeroDuration();

    /// @notice Thrown when settling an auction whose end time has not yet passed.
    error NotEnded(uint256 auctionId);

    /// @param addressBook_ Deployed {AddressBook} used to resolve the {BidManager}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IAuctionHouse
    /// @dev Pulls the NFT into escrow (seller must approve this contract first). `reservePrice` may be
    ///      zero (no reserve); `duration` must be positive.
    function startAuction(
        address nft,
        uint256 tokenId,
        address paymentToken,
        uint256 reservePrice,
        uint64 duration
    ) external override nonReentrant returns (uint256 auctionId) {
        _requireNotGloballyPaused();
        if (nft == address(0) || paymentToken == address(0)) revert ZeroAddress();
        if (duration == 0) revert ZeroDuration();

        // Interaction: custody the NFT. Reverts if caller is not owner/approved.
        IERC721(nft).safeTransferFrom(msg.sender, address(this), tokenId);

        auctionId = _nextAuctionId++;
        uint64 endTime = uint64(block.timestamp) + duration;
        _auctions[auctionId] = Auction({
            auctionId: auctionId,
            nft: nft,
            tokenId: tokenId,
            seller: msg.sender,
            paymentToken: paymentToken,
            reservePrice: reservePrice,
            highestBid: 0,
            highestBidder: address(0),
            endTime: endTime,
            state: AuctionState.Active
        });

        emit AuctionStarted(auctionId, nft, tokenId, msg.sender, endTime);
    }

    /// @inheritdoc IAuctionHouse
    /// @dev The bid must strictly exceed the standing high bid AND meet the reserve. The previous
    ///      leader is refunded before the new bid is escrowed so a self-raise nets only the delta.
    function bid(uint256 auctionId, uint256 amount) external override nonReentrant {
        Auction storage auction = _auctions[auctionId];
        if (auction.state == AuctionState.None) revert UnknownAuction(auctionId);
        if (auction.state != AuctionState.Active) revert AuctionNotActive(auctionId);
        if (block.timestamp >= auction.endTime) revert AuctionEnded(auctionId);

        // Required = the strictly-higher-than-current floor, but never below the reserve.
        uint256 required = auction.highestBid + 1;
        if (auction.reservePrice > required) required = auction.reservePrice;
        if (amount < required) revert BidTooLow(auctionId, amount, required);

        address prevBidder = auction.highestBidder;
        uint256 prevBid = auction.highestBid;

        // Effects: record the new leader before any external token movement (CEI).
        auction.highestBidder = msg.sender;
        auction.highestBid = amount;

        IBidManager bidManager = IBidManager(_addr(Keys.BID_MANAGER));
        // Interactions: refund the outgoing leader FIRST (so a self-raise doesn't double-credit the
        // same escrow), then pull the new leader's funds into escrow.
        if (prevBidder != address(0) && prevBid != 0) {
            bidManager.refundBid(auctionId, prevBidder);
        }
        bidManager.escrowBid(auctionId, msg.sender, auction.paymentToken, amount);

        emit Bid(auctionId, msg.sender, amount);
    }

    /// @inheritdoc IAuctionHouse
    /// @dev Callable by anyone once the clock has expired. With a winner: NFT → winner, escrow →
    ///      seller. With no qualifying bid: NFT returns to the seller.
    function settleAuction(uint256 auctionId) external override nonReentrant {
        Auction storage auction = _auctions[auctionId];
        if (auction.state == AuctionState.None) revert UnknownAuction(auctionId);
        if (auction.state != AuctionState.Active) revert AuctionNotActive(auctionId);
        if (block.timestamp < auction.endTime) revert NotEnded(auctionId);

        // Effects first: mark settled so the interactions below cannot be replayed.
        auction.state = AuctionState.Settled;

        address winner = auction.highestBidder;
        if (winner != address(0)) {
            // NFT to the winner, escrowed funds to the seller.
            IERC721(auction.nft).safeTransferFrom(address(this), winner, auction.tokenId);
            IBidManagerSettle(_addr(Keys.BID_MANAGER)).settleBid(auctionId, winner, auction.seller);
            emit Settled(auctionId, winner, auction.highestBid);
        } else {
            // No bids cleared the reserve: return the NFT to the seller.
            IERC721(auction.nft).safeTransferFrom(address(this), auction.seller, auction.tokenId);
            emit Settled(auctionId, address(0), 0);
        }
    }

    /// @inheritdoc IAuctionHouse
    function auctionOf(uint256 auctionId) external view override returns (Auction memory) {
        Auction memory auction = _auctions[auctionId];
        if (auction.state == AuctionState.None) revert UnknownAuction(auctionId);
        return auction;
    }

    /// @notice Total number of auctions ever started (ids run 1..totalAuctions).
    function totalAuctions() external view returns (uint256) {
        return _nextAuctionId - 1;
    }
}
