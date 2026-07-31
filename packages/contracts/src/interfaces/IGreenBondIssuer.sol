// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IGreenBondIssuer
/// @notice Issues use-of-proceeds green bonds. An issuer defines a bond (principal, fixed coupon in bps, term,
///         eligible green project category); investors subscribe with a stablecoin, coupons are paid per period,
///         and principal is repaid at maturity. Proceeds allocation is reported for impact transparency.
/// @dev deps (AddressBook): StablecoinRegistry, SettlementEscrow, ESGRegistry, SustainabilityOracle.
///      SafeERC20 + nonReentrant on all fund movement.
interface IGreenBondIssuer {
    enum BondState {
        None,
        Offering,
        Active,
        Defaulted,
        Matured,
        Cancelled
    }

    struct Bond {
        bytes32 bondId;
        address issuer;
        address token;
        uint256 principalTarget;
        uint256 principalRaised;
        uint16 couponBps;
        uint32 tenorDays;
        uint32 couponPeriods;
        bytes32 greenCategory;
        uint64 issuedAt;
        uint64 maturesAt;
        BondState state;
    }

    struct Holding {
        uint256 principal;
        uint256 couponsClaimed;
        bool redeemed;
    }

    event BondCreated(
        bytes32 indexed bondId, address indexed issuer, address token, uint256 principalTarget, uint16 couponBps, bytes32 greenCategory
    );
    event Subscribed(bytes32 indexed bondId, address indexed investor, uint256 amount);
    event OfferingClosed(bytes32 indexed bondId, uint256 principalRaised);
    event CouponFunded(bytes32 indexed bondId, uint16 indexed period, uint256 amount);
    event CouponClaimed(bytes32 indexed bondId, address indexed investor, uint256 amount);
    event ProceedsAllocated(bytes32 indexed bondId, bytes32 indexed projectId, uint256 amount);
    event Redeemed(bytes32 indexed bondId, address indexed investor, uint256 principal);
    event BondMatured(bytes32 indexed bondId);
    event BondDefaulted(bytes32 indexed bondId);
    event BondCancelled(bytes32 indexed bondId);

    error BondExists(bytes32 bondId);
    error UnknownBond(bytes32 bondId);
    error InvalidState(bytes32 bondId, BondState expected, BondState actual);
    error NotIssuer(bytes32 bondId);
    error ZeroAmount();
    error TargetExceeded(bytes32 bondId, uint256 requested, uint256 remaining);
    error NothingToClaim(bytes32 bondId, address investor);
    error InvalidTerms();
    error CouponPeriodFunded(bytes32 bondId, uint16 period);
    error InvalidPeriod(bytes32 bondId, uint16 period);
    error NothingToRedeem(bytes32 bondId, address investor);

    /// @notice Create a green bond offering. UNDERWRITER_ROLE / issuer.
    function createBond(
        bytes32 bondId,
        address token,
        uint256 principalTarget,
        uint16 couponBps,
        uint32 tenorDays,
        uint32 couponPeriods,
        bytes32 greenCategory
    ) external;

    /// @notice Subscribe to an offering, transferring stablecoin principal in. nonReentrant.
    function subscribe(bytes32 bondId, uint256 amount) external;

    /// @notice Close the offering and activate the bond. Issuer only.
    function closeOffering(bytes32 bondId) external;

    /// @notice Fund a coupon period's pool for pro-rata investor claims. Issuer only. nonReentrant.
    function fundCoupon(bytes32 bondId, uint16 period, uint256 amount) external;

    /// @notice Claim accrued coupons for the caller's holding. nonReentrant.
    function claimCoupon(bytes32 bondId) external returns (uint256 amount);

    /// @notice Report allocation of raised proceeds to an eligible green project. Issuer only.
    function allocateProceeds(bytes32 bondId, bytes32 projectId, uint256 amount) external;

    /// @notice Repay principal at maturity, moving the bond to Matured. Issuer only. nonReentrant.
    function repayPrincipal(bytes32 bondId) external;

    /// @notice Redeem principal after maturity for the caller's holding. nonReentrant.
    function redeem(bytes32 bondId) external returns (uint256 principal);

    /// @notice Flag a bond as defaulted on missed obligations. UNDERWRITER_ROLE / GOVERNOR_ROLE.
    function markDefaulted(bytes32 bondId) external;

    function bondOf(bytes32 bondId) external view returns (Bond memory);
    function holdingOf(bytes32 bondId, address investor) external view returns (Holding memory);
}
