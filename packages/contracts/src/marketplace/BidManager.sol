// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { IBidManager } from "../interfaces/IBidManager.sol";

/// @title BidManager
/// @notice Neutral escrow vault for auction bids. The {AuctionHouse} pulls a bidder's funds in here
///         when they become the standing high bid, refunds them here when they are out-bid, and — on
///         settlement — releases the winner's escrow to the seller. Keeping the money in a dedicated
///         vault isolates bid custody from auction bookkeeping.
/// @dev Only holders of {MARKET_ROLE} (the AuctionHouse) may move funds; end-users never call this
///      directly. All transfers use `SafeERC20` and every fund-moving external is `nonReentrant`.
///      Amounts pulled are measured from balance deltas so fee-on-transfer tokens can never
///      over-credit an escrow. Implements {IBidManager} and adds a `settleBid` payout used at auction
///      close (a superset of the interface).
contract BidManager is ProofChainAccess, ReentrancyGuard, IBidManager {
    using SafeERC20 for IERC20;

    /// @notice Role granted to trusted market contracts (the {AuctionHouse}) allowed to escrow,
    ///         refund, and settle bids on behalf of bidders.
    bytes32 public constant MARKET_ROLE = keccak256("MARKET_ROLE");

    /// @dev auctionId => bidder => escrowed amount currently held for them.
    mapping(uint256 => mapping(address => uint256)) private _escrowed;

    /// @dev auctionId => bidder => the ERC20 token their escrow is denominated in.
    mapping(uint256 => mapping(address => address)) private _escrowToken;

    /// @notice Emitted when a winning bidder's escrow is released to the seller at settlement.
    event BidSettled(uint256 indexed auctionId, address indexed bidder, address indexed to, uint256 amount);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IBidManager
    /// @dev Pulls `amount` of `token` from `bidder` (who must have approved this contract) and credits
    ///      their escrow for `auctionId`. Restricted to {MARKET_ROLE}.
    function escrowBid(uint256 auctionId, address bidder, address token, uint256 amount)
        external
        override
        nonReentrant
        onlyRole(MARKET_ROLE)
    {
        if (amount == 0) revert ZeroAmount();
        if (bidder == address(0) || token == address(0)) revert ZeroAddress();

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(bidder, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        _escrowed[auctionId][bidder] += received;
        _escrowToken[auctionId][bidder] = token;
        emit BidEscrowed(auctionId, bidder, token, received);
    }

    /// @inheritdoc IBidManager
    /// @dev Returns a bidder's full escrow for `auctionId` back to them (used when out-bid or when an
    ///      auction is cancelled). Restricted to {MARKET_ROLE}.
    function refundBid(uint256 auctionId, address bidder) external override nonReentrant onlyRole(MARKET_ROLE) {
        uint256 amount = _escrowed[auctionId][bidder];
        if (amount == 0) revert NothingToRefund(auctionId, bidder);

        address token = _escrowToken[auctionId][bidder];
        _escrowed[auctionId][bidder] = 0;
        IERC20(token).safeTransfer(bidder, amount);
        emit BidRefunded(auctionId, bidder, amount);
    }

    /// @notice Release a bidder's escrow to a recipient (the auction seller) at settlement.
    /// @dev Extends {IBidManager} for the winning-bid payout leg. Restricted to {MARKET_ROLE}.
    /// @param auctionId The auction being settled.
    /// @param bidder The winning bidder whose escrow is being released.
    /// @param to The recipient of the funds (the auction seller).
    /// @return amount The amount released.
    function settleBid(uint256 auctionId, address bidder, address to)
        external
        nonReentrant
        onlyRole(MARKET_ROLE)
        returns (uint256 amount)
    {
        if (to == address(0)) revert ZeroAddress();
        amount = _escrowed[auctionId][bidder];
        if (amount == 0) revert NothingToRefund(auctionId, bidder);

        address token = _escrowToken[auctionId][bidder];
        _escrowed[auctionId][bidder] = 0;
        IERC20(token).safeTransfer(to, amount);
        emit BidSettled(auctionId, bidder, to, amount);
    }

    /// @inheritdoc IBidManager
    function escrowedOf(uint256 auctionId, address bidder) external view override returns (uint256) {
        return _escrowed[auctionId][bidder];
    }

    /// @notice The ERC20 token a bidder's escrow for an auction is denominated in.
    function escrowTokenOf(uint256 auctionId, address bidder) external view returns (address) {
        return _escrowToken[auctionId][bidder];
    }
}
