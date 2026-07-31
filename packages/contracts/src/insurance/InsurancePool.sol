// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IInsurancePool } from "../interfaces/IInsurancePool.sol";
import { IPolicyManager } from "../interfaces/IPolicyManager.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";
import { IRiskPool } from "../interfaces/IRiskPool.sol";

/// @title InsurancePool
/// @notice Capital pool backing shipment/credit insurance policies.
/// @dev Capital is tracked per-token. Underwriting reserves coverage 1:1 from free capital; any
///      excess coverage beyond free capital is backed by the reinsurance {RiskPool} tranche
///      (real fractional/reinsured underwriting). Payouts draw the pool-backed portion from
///      reserves and the reinsured portion from the RiskPool. All fund movement is `nonReentrant`,
///      uses SafeERC20, and snapshots received amounts for fee-on-transfer safety.
contract InsurancePool is ProofChainAccess, ReentrancyGuard, IInsurancePool {
    using SafeERC20 for IERC20;

    /// @notice Total capital held per token (deposits, incl. earned premium).
    mapping(address => uint256) private _balances;

    /// @notice Capital reserved (locked) against live policies per token — cannot be withdrawn.
    mapping(address => uint256) private _reservedByToken;

    /// @notice Per-provider deposited principal per token (what a provider may withdraw).
    mapping(address => mapping(address => uint256)) private _deposits;

    /// @notice Pool-backed reservation per policy.
    mapping(bytes32 => uint256) private _poolReserved;

    /// @notice Reinsurance-backed reservation per policy (covered by RiskPool on payout).
    mapping(bytes32 => uint256) private _riskReserved;

    /// @notice Settlement token recorded per policy at underwrite time.
    mapping(bytes32 => address) private _policyToken;

    /// @notice Global sum of pool-backed reservations across all tokens (headline liability).
    uint256 private _reservedTotal;

    /// @param addressBook_ Deployed AddressBook.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and POOL_MANAGER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.POOL_MANAGER_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Capital provision
    // ---------------------------------------------------------------------

    /// @inheritdoc IInsurancePool
    function deposit(address token, uint256 amount) external nonReentrant {
        _requireNotGloballyPaused();
        uint256 received = _pullAndCredit(token, msg.sender, amount);
        _deposits[msg.sender][token] += received;
        emit Deposited(msg.sender, token, received);
    }

    /// @notice Pull premium capital into the pool on behalf of a policy holder. PolicyManager only.
    /// @dev Extends {deposit} so the PolicyManager can route a holder's premium into the pool in a
    ///      single approval hop. Credited to the PolicyManager as protocol-owned capital.
    /// @param token Settlement token.
    /// @param from Address the premium is pulled from (the policy holder).
    /// @param amount Premium amount.
    /// @return received Amount actually received (fee-on-transfer safe).
    function depositFrom(address token, address from, uint256 amount)
        external
        nonReentrant
        returns (uint256 received)
    {
        if (msg.sender != _addr(Keys.POLICY_MANAGER)) revert NotAuthorized(msg.sender);
        if (from == address(0)) revert ZeroAddress();
        received = _pullAndCredit(token, from, amount);
        _deposits[msg.sender][token] += received;
        emit Deposited(from, token, received);
    }

    /// @inheritdoc IInsurancePool
    function withdraw(address token, uint256 amount) external nonReentrant {
        _requireNotGloballyPaused();
        if (amount == 0) revert ZeroAmount();

        uint256 provided = _deposits[msg.sender][token];
        if (provided < amount) revert InsufficientCapital(amount, provided);

        uint256 free = availableCapital(token);
        if (free < amount) revert InsufficientCapital(amount, free);

        _deposits[msg.sender][token] = provided - amount;
        _balances[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount);
    }

    // ---------------------------------------------------------------------
    // Underwriting & payout
    // ---------------------------------------------------------------------

    /// @inheritdoc IInsurancePool
    /// @dev PolicyManager only. Reserves `coverage`: first from free pool capital, then the
    ///      remainder from the reinsurance RiskPool (reverting if neither can back it).
    function underwrite(bytes32 policyId, uint256 coverage) external nonReentrant {
        if (msg.sender != _addr(Keys.POLICY_MANAGER)) revert NotAuthorized(msg.sender);
        if (coverage == 0) revert ZeroAmount();

        address token = IPolicyManager(_addr(Keys.POLICY_MANAGER)).policyOf(policyId).token;
        uint256 free = availableCapital(token);
        uint256 poolPart = coverage <= free ? coverage : free;
        uint256 riskPart = coverage - poolPart;

        if (riskPart > 0) {
            address riskPool = _addrOrZero(Keys.RISK_POOL);
            uint256 riskAvail = riskPool == address(0) ? 0 : IRiskPool(riskPool).reserves(token);
            if (riskPool == address(0) || riskAvail < riskPart) {
                revert InsufficientCapital(coverage, free + riskAvail);
            }
        }

        _reservedByToken[token] += poolPart;
        _reservedTotal += poolPart;
        _poolReserved[policyId] = poolPart;
        _riskReserved[policyId] = riskPart;
        _policyToken[policyId] = token;

        emit Underwritten(policyId, coverage);
    }

    /// @inheritdoc IInsurancePool
    /// @dev ClaimsProcessor only. Pays the pool-backed portion from reserves and the reinsured
    ///      portion from the RiskPool, releasing the corresponding reservations.
    function payout(bytes32 policyId, address to, uint256 amount) external nonReentrant {
        if (msg.sender != _addr(Keys.CLAIMS_PROCESSOR)) revert NotAuthorized(msg.sender);
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        address token = _policyToken[policyId];
        uint256 poolRes = _poolReserved[policyId];
        uint256 riskRes = _riskReserved[policyId];
        uint256 totalRes = poolRes + riskRes;
        if (amount > totalRes) revert InsufficientCapital(amount, totalRes);

        uint256 poolPay = amount <= poolRes ? amount : poolRes;
        uint256 riskPay = amount - poolPay;

        // Release reservations and reduce balances before external calls (checks-effects-interactions).
        _poolReserved[policyId] = poolRes - poolPay;
        _riskReserved[policyId] = riskRes - riskPay;
        if (poolPay > 0) {
            _reservedByToken[token] -= poolPay;
            _reservedTotal -= poolPay;
            _balances[token] -= poolPay;
        }

        if (poolPay > 0) {
            IERC20(token).safeTransfer(to, poolPay);
        }
        if (riskPay > 0) {
            IRiskPool(_addr(Keys.RISK_POOL)).cover(policyId, token, to, riskPay);
        }

        emit PaidOut(policyId, to, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @inheritdoc IInsurancePool
    function availableCapital(address token) public view returns (uint256) {
        uint256 bal = _balances[token];
        uint256 reserved = _reservedByToken[token];
        return bal > reserved ? bal - reserved : 0;
    }

    /// @inheritdoc IInsurancePool
    function reservedCapital() external view returns (uint256) {
        return _reservedTotal;
    }

    /// @notice Total capital held for `token` (free + reserved).
    function totalCapital(address token) external view returns (uint256) {
        return _balances[token];
    }

    /// @notice Principal a provider may still withdraw for `token`.
    function depositOf(address provider, address token) external view returns (uint256) {
        return _deposits[provider][token];
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    /// @dev Validate token acceptance, pull funds, credit the pool balance, return received amount.
    function _pullAndCredit(address token, address from, uint256 amount) private returns (uint256 received) {
        if (token == address(0)) revert TokenNotAccepted(address(0));
        if (amount == 0) revert ZeroAmount();
        _requireAccepted(token);

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amount);
        received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        _balances[token] += received;
    }

    /// @dev Enforce the StablecoinRegistry allowlist when it is wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
