// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IReceivableSecuritization
/// @notice Pools attested receivables into a special-purpose structure and issues waterfall tranches
///         (senior/mezzanine/junior) as {ITrancheToken} shares. Collections are distributed top-down:
///         senior principal+coupon first, residual to junior. Losses hit junior first.
/// @dev deps (AddressBook): AttestationRegistry, ReceivableRegistry, TrancheToken, StablecoinRegistry.
interface IReceivableSecuritization {
    enum PoolState {
        None,
        Open,
        Sealed,
        Distributing,
        Closed
    }

    struct Tranche {
        address token;
        uint16 seniority;
        uint256 principal;
        uint16 couponBps;
        uint256 distributed;
    }

    struct Pool {
        bytes32 poolId;
        address sponsor;
        address token;
        uint256 totalReceivables;
        uint256 collected;
        uint8 trancheCount;
        PoolState state;
    }

    event PoolCreated(bytes32 indexed poolId, address indexed sponsor, address token);
    event ReceivableAdded(bytes32 indexed poolId, bytes32 indexed batchId, uint256 amount);
    event TrancheDefined(bytes32 indexed poolId, uint8 indexed trancheIndex, address trancheToken, uint16 seniority, uint256 principal, uint16 couponBps);
    event PoolSealed(bytes32 indexed poolId, uint256 totalReceivables);
    event Collected(bytes32 indexed poolId, uint256 amount);
    event Distributed(bytes32 indexed poolId, uint8 indexed trancheIndex, uint256 amount);
    event PoolClosed(bytes32 indexed poolId);

    error PoolExists(bytes32 poolId);
    error UnknownPool(bytes32 poolId);
    error InvalidState(bytes32 poolId, PoolState expected, PoolState actual);
    error NotSponsor(bytes32 poolId);
    error NotAttested(bytes32 batchId);
    error UnknownTranche(bytes32 poolId, uint8 trancheIndex);
    error ZeroAmount();
    error NothingToDistribute(bytes32 poolId);

    /// @notice Sponsor opens a new securitization pool.
    function createPool(bytes32 poolId, address token) external;

    /// @notice Add an attested receivable to an open pool.
    function addReceivable(bytes32 poolId, bytes32 batchId, uint256 amount) external;

    /// @notice Define a waterfall tranche backed by a deployed {ITrancheToken}.
    function defineTranche(bytes32 poolId, uint8 trancheIndex, address trancheToken, uint16 seniority, uint256 principal, uint16 couponBps)
        external;

    /// @notice Seal the pool, freezing composition and enabling distribution.
    function seal(bytes32 poolId) external;

    /// @notice Record collections into the pool.
    function collect(bytes32 poolId, uint256 amount) external;

    /// @notice Run the waterfall, distributing available cash senior-first.
    function distribute(bytes32 poolId) external;

    /// @notice Close a fully-distributed pool.
    function close(bytes32 poolId) external;

    function poolOf(bytes32 poolId) external view returns (Pool memory);
    function trancheOf(bytes32 poolId, uint8 trancheIndex) external view returns (Tranche memory);
}
