// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IDataMarketplace
/// @notice Marketplace for supply-chain datasets (sensor logs, provenance exports, ESG data). A provider lists
///         a dataset with a stablecoin price and an encrypted-content pointer; buyers purchase time-boxed access,
///         funds settle to the provider net of a protocol fee, and access grants are recorded on-chain.
/// @dev deps (AddressBook): StablecoinRegistry, FeeManager, Treasury, IoTSensorRegistry.
///      SafeERC20 + nonReentrant on all fund movement.
interface IDataMarketplace {
    enum ListingState {
        None,
        Active,
        Paused,
        Delisted
    }

    struct Listing {
        bytes32 listingId;
        address provider;
        address token;
        uint256 price;
        uint32 accessDays;
        bytes32 contentHash;
        string uri;
        ListingState state;
    }

    struct Access {
        bytes32 listingId;
        address buyer;
        uint64 grantedAt;
        uint64 expiresAt;
    }

    event Listed(bytes32 indexed listingId, address indexed provider, address token, uint256 price, uint32 accessDays);
    event PriceUpdated(bytes32 indexed listingId, uint256 price);
    event ListingStateChanged(bytes32 indexed listingId, ListingState state);
    event AccessPurchased(bytes32 indexed listingId, address indexed buyer, uint256 price, uint64 expiresAt);

    error ListingExists(bytes32 listingId);
    error UnknownListing(bytes32 listingId);
    error NotProvider(bytes32 listingId);
    error InvalidState(bytes32 listingId, ListingState expected, ListingState actual);
    error ZeroPrice();
    error SelfPurchase(bytes32 listingId);

    /// @notice List a dataset for sale. Provider must be an onboarded org.
    function list(
        bytes32 listingId,
        address token,
        uint256 price,
        uint32 accessDays,
        bytes32 contentHash,
        string calldata uri
    ) external;

    /// @notice Update a listing's price. Provider only.
    function updatePrice(bytes32 listingId, uint256 price) external;

    /// @notice Pause/reactivate/delist a listing. Provider only.
    function setState(bytes32 listingId, ListingState state) external;

    /// @notice Purchase time-boxed access to a dataset, settling payment net of protocol fee. nonReentrant.
    function purchase(bytes32 listingId) external returns (uint64 expiresAt);

    /// @notice True if the buyer holds unexpired access to a listing.
    function hasAccess(bytes32 listingId, address buyer) external view returns (bool);

    function listingOf(bytes32 listingId) external view returns (Listing memory);
    function accessOf(bytes32 listingId, address buyer) external view returns (Access memory);
}
