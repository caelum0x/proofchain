// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { ICommodityVault } from "../interfaces/ICommodityVault.sol";
import { ICommodityToken } from "../interfaces/ICommodityToken.sol";
import { IStorageReceipt } from "../interfaces/IStorageReceipt.sol";

/// @title CommodityVault
/// @notice Custody bridge between physical warehoused commodity and its fungible {CommodityToken}. A holder
///         pledges a verified {StorageReceipt} to the vault (placing a lien) and deposits it to mint backing
///         tokens 1:1 with the receipt's warehoused quantity; burning the tokens redeems the receipt and
///         releases the lien for physical withdrawal.
/// @dev Enforces full backing: every token in circulation is matched by a Collateralized receipt held under
///      lien by this vault. All peers (token, receipt) are resolved through the {AddressBook}. Deposit and
///      redeem are `nonReentrant` and follow checks-effects-interactions before touching the token supply.
contract CommodityVault is ProofChainAccess, ReentrancyGuard, ICommodityVault {
    /// @dev receiptId => custody position.
    mapping(bytes32 => Position) private _positions;

    /// @dev Total token amount currently backed by collateralized receipts.
    uint256 private _totalBacked;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc ICommodityVault
    function deposit(bytes32 receiptId) external override nonReentrant returns (uint256 tokenAmount) {
        _requireNotGloballyPaused();

        ICommodityToken token = ICommodityToken(_addr(Keys.COMMODITY_TOKEN));
        IStorageReceipt receipts = IStorageReceipt(_addr(Keys.STORAGE_RECEIPT));
        IStorageReceipt.Receipt memory r = receipts.receiptOf(receiptId);

        if (r.holder != msg.sender) revert NotHolder(receiptId);
        if (_positions[receiptId].state != PositionState.None) revert PositionExists(receiptId);

        // Eligible only when the holder has pledged the receipt to THIS vault as lien holder, the receipt
        // has not expired, and it represents exactly the commodity/grade this vault's token backs.
        bool eligible = r.state == IStorageReceipt.ReceiptState.Pledged && r.lienHolder == address(this)
            && (r.expiresAt == 0 || block.timestamp <= r.expiresAt) && r.commodityCode == token.commodityCode()
            && r.grade == token.grade();
        if (!eligible) revert ReceiptNotEligible(receiptId);

        tokenAmount = r.quantityKg * (10 ** IERC20Metadata(address(token)).decimals());
        if (tokenAmount == 0) revert ZeroAmount();

        // Effects before interactions.
        _positions[receiptId] = Position({
            receiptId: receiptId,
            holder: msg.sender,
            commodityCode: r.commodityCode,
            tokenAmount: tokenAmount,
            depositedAt: uint64(block.timestamp),
            state: PositionState.Collateralized
        });
        _totalBacked += tokenAmount;

        token.mint(msg.sender, tokenAmount, receiptId);
        emit Deposited(receiptId, msg.sender, r.commodityCode, tokenAmount);
    }

    /// @inheritdoc ICommodityVault
    function redeem(bytes32 receiptId) external override nonReentrant {
        _requireNotGloballyPaused();

        Position storage p = _positions[receiptId];
        if (p.state == PositionState.None) revert UnknownPosition(receiptId);
        if (p.state != PositionState.Collateralized) {
            revert InvalidState(receiptId, PositionState.Collateralized, p.state);
        }
        if (p.holder != msg.sender) revert NotHolder(receiptId);

        uint256 amount = p.tokenAmount;

        // Effects before interactions.
        p.state = PositionState.Redeemed;
        _totalBacked -= amount;

        // Burn the caller's backing tokens, then release the lien so the receipt can be withdrawn.
        ICommodityToken(_addr(Keys.COMMODITY_TOKEN)).burn(msg.sender, amount, receiptId);
        IStorageReceipt(_addr(Keys.STORAGE_RECEIPT)).releaseLien(receiptId);

        emit Redeemed(receiptId, msg.sender, amount);
    }

    /// @inheritdoc ICommodityVault
    function totalBacked() external view override returns (uint256) {
        return _totalBacked;
    }

    /// @inheritdoc ICommodityVault
    function positionOf(bytes32 receiptId) external view override returns (Position memory) {
        return _positions[receiptId];
    }
}
