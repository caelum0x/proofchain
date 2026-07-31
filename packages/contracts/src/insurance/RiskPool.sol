// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IRiskPool } from "../interfaces/IRiskPool.sol";

/// @title RiskPool
/// @notice Reinsurance tranche that absorbs tail losses beyond the primary {InsurancePool}.
/// @dev Reserves are held per-token. Only the InsurancePool or ClaimsProcessor (resolved via the
///      AddressBook) may draw down reserves via {cover}. All fund movement is `nonReentrant` and
///      uses SafeERC20 with received-amount snapshots for fee-on-transfer safety.
contract RiskPool is ProofChainAccess, ReentrancyGuard, IRiskPool {
    using SafeERC20 for IERC20;

    /// @notice Reserves available per token.
    mapping(address => uint256) private _reserves;

    /// @param addressBook_ Deployed AddressBook.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IRiskPool
    function topUp(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        _reserves[token] += received;
        emit ToppedUp(msg.sender, token, received);
    }

    /// @inheritdoc IRiskPool
    /// @dev Callable only by the InsurancePool or ClaimsProcessor.
    function cover(bytes32 policyId, address token, address to, uint256 amount) external nonReentrant {
        _requireAuthorized();
        if (amount == 0) revert ZeroAmount();

        uint256 available = _reserves[token];
        if (amount > available) revert InsufficientReserves(amount, available);

        _reserves[token] = available - amount;
        IERC20(token).safeTransfer(to, amount);
        emit Covered(policyId, to, amount);
    }

    /// @inheritdoc IRiskPool
    function reserves(address token) external view returns (uint256) {
        return _reserves[token];
    }

    /// @dev Revert unless the caller is the wired InsurancePool or ClaimsProcessor.
    function _requireAuthorized() private view {
        address pool = _addrOrZero(Keys.INSURANCE_POOL);
        address claims = _addrOrZero(Keys.CLAIMS_PROCESSOR);
        if (msg.sender != pool && msg.sender != claims) revert NotAuthorized(msg.sender);
    }
}
