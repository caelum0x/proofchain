// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IIdentityResolver
/// @notice Unified read across the identity registries: resolves a role/org/name for an address.
/// @dev deps (AddressBook): SupplierRegistry, BuyerRegistry, CarrierRegistry, OrganizationRegistry.
interface IIdentityResolver {
    enum ActorRole {
        Unknown,
        Supplier,
        Buyer,
        Carrier
    }

    struct Identity {
        ActorRole role;
        bytes32 orgId;
        string name;
    }

    /// @notice Resolve the best-known identity for `account`.
    function who(address account) external view returns (Identity memory);

    function roleOf(address account) external view returns (ActorRole);
}
