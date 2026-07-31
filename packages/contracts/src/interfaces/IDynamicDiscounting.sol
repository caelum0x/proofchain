// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IDynamicDiscounting
/// @notice Buyer-funded early payment: for a buyer-approved invoice the buyer offers a sliding discount
///         that decays linearly toward the due date. The supplier accepts to be paid early at the
///         discount corresponding to the acceptance day; the buyer's escrowed funds settle immediately.
/// @dev deps (AddressBook): AttestationRegistry, SettlementEscrow, StablecoinRegistry.
interface IDynamicDiscounting {
    enum OfferState {
        None,
        Open,
        Accepted,
        Expired,
        Cancelled
    }

    struct Offer {
        bytes32 offerId;
        bytes32 batchId;
        address buyer;
        address supplier;
        address token;
        uint256 faceAmount;
        uint16 maxDiscountBps;
        uint64 offerStart;
        uint64 dueDate;
        OfferState state;
    }

    event OfferOpened(
        bytes32 indexed offerId,
        bytes32 indexed batchId,
        address indexed supplier,
        address buyer,
        uint256 faceAmount,
        uint16 maxDiscountBps,
        uint64 dueDate
    );
    event OfferAccepted(bytes32 indexed offerId, uint256 discountBps, uint256 paidAmount);
    event OfferExpired(bytes32 indexed offerId);
    event OfferCancelled(bytes32 indexed offerId);

    error OfferExists(bytes32 offerId);
    error UnknownOffer(bytes32 offerId);
    error InvalidState(bytes32 offerId, OfferState expected, OfferState actual);
    error NotSupplier(bytes32 offerId);
    error NotBuyer(bytes32 offerId);
    error ZeroAmount();
    error InvalidWindow(uint64 offerStart, uint64 dueDate);
    error PastDueDate(uint64 dueDate);

    /// @notice Buyer opens a discount offer on an approved invoice, escrowing the face amount.
    function openOffer(
        bytes32 offerId,
        bytes32 batchId,
        address supplier,
        address token,
        uint256 faceAmount,
        uint16 maxDiscountBps,
        uint64 dueDate
    ) external;

    /// @notice Supplier accepts early payment at the current (time-decayed) discount.
    function accept(bytes32 offerId) external;

    /// @notice Mark an unaccepted offer expired after the due date.
    function expire(bytes32 offerId) external;

    /// @notice Buyer cancels an open, unaccepted offer.
    function cancel(bytes32 offerId) external;

    /// @notice Discount (bps) currently applicable to `offerId`, decayed toward the due date.
    function currentDiscountBps(bytes32 offerId) external view returns (uint16);

    function offerOf(bytes32 offerId) external view returns (Offer memory);
}
