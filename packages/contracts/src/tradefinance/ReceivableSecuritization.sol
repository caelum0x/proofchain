// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IReceivableSecuritization } from "../interfaces/IReceivableSecuritization.sol";
import { IAttestationRegistry } from "../interfaces/IAttestationRegistry.sol";
import { ITrancheToken } from "../interfaces/ITrancheToken.sol";

/// @title ReceivableSecuritization
/// @notice Pools AI-attested receivables into a special-purpose structure and issues waterfall
///         tranches as {ITrancheToken} shares. Collections are distributed strictly senior-first:
///         each tranche is owed its principal plus coupon before any junior tranche receives cash,
///         and each tranche's allocation is claimable pro-rata by its share holders.
/// @dev Distribution is an in-contract accounting waterfall; holders `redeem` shares for their
///      pro-rata slice of their tranche's cash pot. Money movement via {SafeERC20} + `nonReentrant`.
///      This contract must hold `MINTER_ROLE` on every tranche token (to burn on redemption). Peers
///      resolved via {AddressBook}; tranche indices are defined sequentially (0 = most senior slot).
contract ReceivableSecuritization is ProofChainAccess, ReentrancyGuard, IReceivableSecuritization {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    mapping(bytes32 => Pool) private _pools;
    mapping(bytes32 => mapping(uint8 => Tranche)) private _tranches;
    mapping(bytes32 => mapping(uint8 => uint256)) private _trancheCash;
    mapping(bytes32 => uint256) private _totalDistributed;

    /// @notice Emitted when a holder redeems tranche shares for cash.
    event Redeemed(bytes32 indexed poolId, uint8 indexed trancheIndex, address indexed holder, uint256 shares, uint256 cashPaid);

    /// @notice Tranches must be defined with strictly sequential indices.
    error UnexpectedTrancheIndex(uint8 expected, uint8 actual);
    /// @notice A coupon rate of 100% or more was supplied.
    error InvalidCoupon(uint16 couponBps);
    /// @notice The pool has no tranches to seal.
    error NoTranches(bytes32 poolId);
    /// @notice The caller holds no shares, or the tranche has no distributable cash.
    error NothingToRedeem(bytes32 poolId, uint8 trancheIndex);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IReceivableSecuritization
    function createPool(bytes32 poolId, address token) external {
        _requireNotGloballyPaused();
        if (_pools[poolId].state != PoolState.None) revert PoolExists(poolId);
        if (token == address(0)) revert ZeroAddress();

        _pools[poolId] = Pool({
            poolId: poolId,
            sponsor: msg.sender,
            token: token,
            totalReceivables: 0,
            collected: 0,
            trancheCount: 0,
            state: PoolState.Open
        });

        emit PoolCreated(poolId, msg.sender, token);
    }

    /// @inheritdoc IReceivableSecuritization
    function addReceivable(bytes32 poolId, bytes32 batchId, uint256 amount) external {
        Pool storage p = _pools[poolId];
        _requireState(p, poolId, PoolState.Open);
        if (msg.sender != p.sponsor) revert NotSponsor(poolId);
        if (amount == 0) revert ZeroAmount();
        if (!IAttestationRegistry(_addr(Keys.ATTESTATION_REGISTRY)).isAttested(batchId)) revert NotAttested(batchId);

        p.totalReceivables += amount;
        emit ReceivableAdded(poolId, batchId, amount);
    }

    /// @inheritdoc IReceivableSecuritization
    function defineTranche(
        bytes32 poolId,
        uint8 trancheIndex,
        address trancheToken,
        uint16 seniority,
        uint256 principal,
        uint16 couponBps
    ) external {
        Pool storage p = _pools[poolId];
        _requireState(p, poolId, PoolState.Open);
        if (msg.sender != p.sponsor) revert NotSponsor(poolId);
        if (trancheIndex != p.trancheCount) revert UnexpectedTrancheIndex(p.trancheCount, trancheIndex);
        if (trancheToken == address(0)) revert ZeroAddress();
        if (principal == 0) revert ZeroAmount();
        if (couponBps >= BPS) revert InvalidCoupon(couponBps);

        _tranches[poolId][trancheIndex] = Tranche({
            token: trancheToken,
            seniority: seniority,
            principal: principal,
            couponBps: couponBps,
            distributed: 0
        });
        p.trancheCount = trancheIndex + 1;

        emit TrancheDefined(poolId, trancheIndex, trancheToken, seniority, principal, couponBps);
    }

    /// @inheritdoc IReceivableSecuritization
    function seal(bytes32 poolId) external {
        Pool storage p = _pools[poolId];
        _requireState(p, poolId, PoolState.Open);
        if (msg.sender != p.sponsor) revert NotSponsor(poolId);
        if (p.trancheCount == 0) revert NoTranches(poolId);

        p.state = PoolState.Sealed;
        emit PoolSealed(poolId, p.totalReceivables);
    }

    /// @inheritdoc IReceivableSecuritization
    function collect(bytes32 poolId, uint256 amount) external nonReentrant {
        Pool storage p = _pools[poolId];
        _requireExists(p, poolId);
        if (p.state != PoolState.Sealed && p.state != PoolState.Distributing) {
            revert InvalidState(poolId, PoolState.Sealed, p.state);
        }
        if (amount == 0) revert ZeroAmount();

        p.collected += amount;
        // Pull the collected receivable cash into the SPV from the servicer/caller.
        IERC20(p.token).safeTransferFrom(msg.sender, address(this), amount);
        emit Collected(poolId, amount);
    }

    /// @inheritdoc IReceivableSecuritization
    function distribute(bytes32 poolId) external nonReentrant {
        Pool storage p = _pools[poolId];
        _requireExists(p, poolId);
        if (p.state != PoolState.Sealed && p.state != PoolState.Distributing) {
            revert InvalidState(poolId, PoolState.Sealed, p.state);
        }

        uint256 available = p.collected - _totalDistributed[poolId];
        if (available == 0) revert NothingToDistribute(poolId);

        p.state = PoolState.Distributing;

        uint8 count = p.trancheCount;
        uint8[] memory order = _orderedIndices(poolId, count);

        uint256 distributedNow;
        for (uint256 i = 0; i < count && available > 0; i++) {
            uint8 idx = order[i];
            Tranche storage t = _tranches[poolId][idx];
            uint256 target = t.principal + (t.principal * t.couponBps) / BPS;
            if (t.distributed >= target) continue;

            uint256 owed = target - t.distributed;
            uint256 pay = owed < available ? owed : available;

            t.distributed += pay;
            _trancheCash[poolId][idx] += pay;
            available -= pay;
            distributedNow += pay;

            emit Distributed(poolId, idx, pay);
        }

        _totalDistributed[poolId] += distributedNow;
    }

    /// @inheritdoc IReceivableSecuritization
    function close(bytes32 poolId) external {
        Pool storage p = _pools[poolId];
        _requireExists(p, poolId);
        if (p.state != PoolState.Distributing && p.state != PoolState.Sealed) {
            revert InvalidState(poolId, PoolState.Distributing, p.state);
        }
        if (msg.sender != p.sponsor) revert NotSponsor(poolId);

        p.state = PoolState.Closed;
        emit PoolClosed(poolId);
    }

    /// @notice Redeem `shares` of tranche `trancheIndex` for a pro-rata slice of its distributed cash.
    /// @dev The caller's shares are burned and their proportional cash pot is paid out. Requires this
    ///      contract to hold MINTER_ROLE on the tranche token.
    function redeem(bytes32 poolId, uint8 trancheIndex, uint256 shares) external nonReentrant {
        Pool storage p = _pools[poolId];
        _requireExists(p, poolId);
        if (trancheIndex >= p.trancheCount) revert UnknownTranche(poolId, trancheIndex);
        if (shares == 0) revert ZeroAmount();

        ITrancheToken tt = ITrancheToken(_tranches[poolId][trancheIndex].token);
        uint256 supply = tt.totalSupply();
        uint256 pot = _trancheCash[poolId][trancheIndex];
        if (supply == 0 || pot == 0) revert NothingToRedeem(poolId, trancheIndex);

        uint256 bal = tt.balanceOf(msg.sender);
        if (bal < shares) revert ITrancheToken.InsufficientBalance(msg.sender, shares, bal);

        uint256 cashPaid = (pot * shares) / supply;
        if (cashPaid == 0) revert NothingToRedeem(poolId, trancheIndex);

        _trancheCash[poolId][trancheIndex] = pot - cashPaid;

        // Burn first (effects), then pay (interaction).
        tt.burn(msg.sender, shares);
        IERC20(p.token).safeTransfer(msg.sender, cashPaid);

        emit Redeemed(poolId, trancheIndex, msg.sender, shares, cashPaid);
    }

    /// @inheritdoc IReceivableSecuritization
    function poolOf(bytes32 poolId) external view returns (Pool memory) {
        return _pools[poolId];
    }

    /// @inheritdoc IReceivableSecuritization
    function trancheOf(bytes32 poolId, uint8 trancheIndex) external view returns (Tranche memory) {
        if (trancheIndex >= _pools[poolId].trancheCount) revert UnknownTranche(poolId, trancheIndex);
        return _tranches[poolId][trancheIndex];
    }

    /// @notice Distributed cash currently claimable by holders of tranche `trancheIndex`.
    function trancheCashOf(bytes32 poolId, uint8 trancheIndex) external view returns (uint256) {
        return _trancheCash[poolId][trancheIndex];
    }

    /// @notice Total cash already allocated down the waterfall for `poolId`.
    function totalDistributedOf(bytes32 poolId) external view returns (uint256) {
        return _totalDistributed[poolId];
    }

    /// @dev Tranche indices sorted by ascending seniority (0 = most senior), stable insertion sort.
    function _orderedIndices(bytes32 poolId, uint8 count) private view returns (uint8[] memory order) {
        order = new uint8[](count);
        for (uint8 i = 0; i < count; i++) {
            order[i] = i;
        }
        for (uint256 i = 1; i < count; i++) {
            uint8 key = order[i];
            uint16 keySen = _tranches[poolId][key].seniority;
            uint256 j = i;
            while (j > 0 && _tranches[poolId][order[j - 1]].seniority > keySen) {
                order[j] = order[j - 1];
                j--;
            }
            order[j] = key;
        }
    }

    function _requireExists(Pool storage p, bytes32 poolId) private view {
        if (p.state == PoolState.None) revert UnknownPool(poolId);
    }

    function _requireState(Pool storage p, bytes32 poolId, PoolState expected) private view {
        if (p.state == PoolState.None) revert UnknownPool(poolId);
        if (p.state != expected) revert InvalidState(poolId, expected, p.state);
    }
}
