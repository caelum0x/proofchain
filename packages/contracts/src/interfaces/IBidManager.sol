// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IBidManager
/// @notice Escrows auction/order bids and refunds losers.
interface IBidManager {
    event BidEscrowed(uint256 indexed auctionId, address indexed bidder, address token, uint256 amount);
    event BidRefunded(uint256 indexed auctionId, address indexed bidder, uint256 amount);

    error ZeroAmount();
    error NothingToRefund(uint256 auctionId, address bidder);
    error NotAuthorized(address caller);

    /// @notice Escrow a bidder's funds for an auction. Authorized market contracts only.
    function escrowBid(uint256 auctionId, address bidder, address token, uint256 amount) external;

    /// @notice Refund a bidder's escrowed funds. Authorized market contracts only.
    function refundBid(uint256 auctionId, address bidder) external;

    function escrowedOf(uint256 auctionId, address bidder) external view returns (uint256);
}
