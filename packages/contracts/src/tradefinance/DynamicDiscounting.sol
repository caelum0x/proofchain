// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IDynamicDiscounting } from "../interfaces/IDynamicDiscounting.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title DynamicDiscounting
/// @notice Buyer-funded early payment. A buyer escrows a face amount and offers a sliding discount
///         that decays linearly from `maxDiscountBps` at the offer start to 0 at the due date. The
///         supplier accepts to be paid immediately at the discount for the acceptance day; the
///         discount portion returns to the buyer.
/// @dev Face amount is escrowed on `openOffer`. Payout / refund use {SafeERC20} and are
///      `nonReentrant`. The time-decay is a pure linear interpolation. Peers via {AddressBook}.
contract DynamicDiscounting is ProofChainAccess, ReentrancyGuard, IDynamicDiscounting {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    mapping(bytes32 => Offer) private _offers;

    /// @notice A settlement token outside the {StablecoinRegistry} allowlist was supplied.
    error TokenNotAccepted(address token);
    /// @notice A discount rate of 100% or more was supplied.
    error InvalidDiscount(uint16 maxDiscountBps);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IDynamicDiscounting
    function openOffer(
        bytes32 offerId,
        bytes32 batchId,
        address supplier,
        address token,
        uint256 faceAmount,
        uint16 maxDiscountBps,
        uint64 dueDate
    ) external nonReentrant {
        _requireNotGloballyPaused();
        if (_offers[offerId].state != OfferState.None) revert OfferExists(offerId);
        if (faceAmount == 0) revert ZeroAmount();
        if (supplier == address(0) || token == address(0)) revert ZeroAddress();
        if (maxDiscountBps >= BPS) revert InvalidDiscount(maxDiscountBps);
        if (dueDate <= block.timestamp) revert PastDueDate(dueDate);
        _requireAccepted(token);

        uint64 offerStart = uint64(block.timestamp);
        if (dueDate <= offerStart) revert InvalidWindow(offerStart, dueDate);

        _offers[offerId] = Offer({
            offerId: offerId,
            batchId: batchId,
            buyer: msg.sender,
            supplier: supplier,
            token: token,
            faceAmount: faceAmount,
            maxDiscountBps: maxDiscountBps,
            offerStart: offerStart,
            dueDate: dueDate,
            state: OfferState.Open
        });

        // Escrow the invoice face amount from the buyer up-front.
        IERC20(token).safeTransferFrom(msg.sender, address(this), faceAmount);
        emit OfferOpened(offerId, batchId, supplier, msg.sender, faceAmount, maxDiscountBps, dueDate);
    }

    /// @inheritdoc IDynamicDiscounting
    function accept(bytes32 offerId) external nonReentrant {
        Offer storage o = _offers[offerId];
        _requireExists(o, offerId);
        if (o.state != OfferState.Open) revert InvalidState(offerId, OfferState.Open, o.state);
        if (msg.sender != o.supplier) revert NotSupplier(offerId);
        if (block.timestamp >= o.dueDate) revert PastDueDate(o.dueDate);

        uint256 discountBps = _discountBps(o);
        uint256 face = o.faceAmount;
        uint256 discount = (face * discountBps) / BPS;
        uint256 paidAmount = face - discount;

        o.state = OfferState.Accepted;

        IERC20 token = IERC20(o.token);
        if (paidAmount > 0) token.safeTransfer(o.supplier, paidAmount);
        if (discount > 0) token.safeTransfer(o.buyer, discount); // unused discount returns to buyer

        emit OfferAccepted(offerId, discountBps, paidAmount);
    }

    /// @inheritdoc IDynamicDiscounting
    function expire(bytes32 offerId) external nonReentrant {
        Offer storage o = _offers[offerId];
        _requireExists(o, offerId);
        if (o.state != OfferState.Open) revert InvalidState(offerId, OfferState.Open, o.state);
        if (block.timestamp < o.dueDate) revert PastDueDate(o.dueDate);

        uint256 face = o.faceAmount;
        address buyer = o.buyer;
        o.state = OfferState.Expired;

        IERC20(o.token).safeTransfer(buyer, face);
        emit OfferExpired(offerId);
    }

    /// @inheritdoc IDynamicDiscounting
    function cancel(bytes32 offerId) external nonReentrant {
        Offer storage o = _offers[offerId];
        _requireExists(o, offerId);
        if (o.state != OfferState.Open) revert InvalidState(offerId, OfferState.Open, o.state);
        if (msg.sender != o.buyer) revert NotBuyer(offerId);

        uint256 face = o.faceAmount;
        address buyer = o.buyer;
        o.state = OfferState.Cancelled;

        IERC20(o.token).safeTransfer(buyer, face);
        emit OfferCancelled(offerId);
    }

    /// @inheritdoc IDynamicDiscounting
    function currentDiscountBps(bytes32 offerId) external view returns (uint16) {
        Offer memory o = _offers[offerId];
        if (o.state != OfferState.Open) return 0;
        return uint16(_discountBps(o));
    }

    /// @inheritdoc IDynamicDiscounting
    function offerOf(bytes32 offerId) external view returns (Offer memory) {
        return _offers[offerId];
    }

    /// @dev Linear decay of the discount from `maxDiscountBps` at `offerStart` to 0 at `dueDate`.
    function _discountBps(Offer memory o) private view returns (uint256) {
        if (block.timestamp <= o.offerStart) return o.maxDiscountBps;
        if (block.timestamp >= o.dueDate) return 0;
        uint256 window = uint256(o.dueDate) - uint256(o.offerStart);
        uint256 remaining = uint256(o.dueDate) - block.timestamp;
        return (uint256(o.maxDiscountBps) * remaining) / window;
    }

    function _requireExists(Offer storage o, bytes32 offerId) private view {
        if (o.state == OfferState.None) revert UnknownOffer(offerId);
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
