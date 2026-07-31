// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { IFeeManager } from "../interfaces/IFeeManager.sol";
import { ITreasury } from "../interfaces/ITreasury.sol";
import { Keys } from "../core/Keys.sol";

/// @title FeeManager
/// @notice Computes protocol fees (bps per action) and collects them into the {Treasury}.
/// @dev Fee rates are keyed by a `bytes32` action id (e.g. keccak256("SETTLE")). `collect`
///      pulls the computed fee from a payer, then forwards it to the Treasury via a scoped,
///      immediately-reset approval so no residual allowance is ever left dangling.
contract FeeManager is ProofChainAccess, ReentrancyGuard, IFeeManager {
    using SafeERC20 for IERC20;

    /// @notice Basis-points denominator (100% == 10_000 bps).
    uint16 public constant MAX_BPS = 10_000;

    mapping(bytes32 => uint16) private _feeBps;

    /// @param addressBook_ Deployed AddressBook (resolves the Treasury peer).
    /// @param admin Address granted DEFAULT_ADMIN_ROLE (the only role that sets fee rates).
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IFeeManager
    function setFeeBps(bytes32 action, uint16 bps) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bps > MAX_BPS) revert InvalidBps(bps);
        _feeBps[action] = bps;
        emit FeeBpsSet(action, bps);
    }

    /// @inheritdoc IFeeManager
    function feeFor(bytes32 action, uint256 amount) public view override returns (uint256) {
        return (amount * _feeBps[action]) / MAX_BPS;
    }

    /// @inheritdoc IFeeManager
    function feeBps(bytes32 action) external view override returns (uint16) {
        return _feeBps[action];
    }

    /// @inheritdoc IFeeManager
    function collect(bytes32 action, address token, address payer, uint256 amount)
        external
        override
        nonReentrant
        returns (uint256 fee)
    {
        if (token == address(0) || payer == address(0)) revert ZeroAddress();

        fee = feeFor(action, amount);
        if (fee == 0) return 0;

        address treasury = _addr(Keys.TREASURY);

        // Pull the fee from the payer, then bank it in the Treasury (which tracks its own
        // internal balances). The Treasury approval is scoped to exactly `fee` and reset to 0.
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(payer, address(this), fee);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;

        IERC20(token).forceApprove(treasury, received);
        ITreasury(treasury).deposit(token, received);
        IERC20(token).forceApprove(treasury, 0);

        emit FeeCollected(action, token, payer, received);
        return received;
    }
}
