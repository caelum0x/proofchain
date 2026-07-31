// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IFinancingMarketplace
/// @notice Order book of receivable-financing offers and bids.
/// @dev deps (AddressBook): InvoiceFinancing, ListingRegistry.
interface IFinancingMarketplace {
    struct Offer {
        uint256 offerId;
        bytes32 batchId;
        address maker;
        address token;
        uint256 amount;
        bool taken;
        bool cancelled;
    }

    event OfferMade(uint256 indexed offerId, bytes32 indexed batchId, address indexed maker, uint256 amount);
    event OfferTaken(uint256 indexed offerId, address indexed taker);
    event OfferCancelled(uint256 indexed offerId);

    error UnknownOffer(uint256 offerId);
    error OfferClosed(uint256 offerId);
    error NotMaker(uint256 offerId);
    error ZeroAmount();

    /// @notice Make a financing offer against a listed receivable.
    function makeOffer(bytes32 batchId, address token, uint256 amount) external returns (uint256 offerId);

    /// @notice Take an open offer, executing the financing.
    function takeOffer(uint256 offerId) external;

    /// @notice Cancel an open offer you made.
    function cancelOffer(uint256 offerId) external;

    function offerOf(uint256 offerId) external view returns (Offer memory);
}
