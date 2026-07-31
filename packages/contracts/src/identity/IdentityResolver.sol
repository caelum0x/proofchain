// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { IIdentityResolver } from "../interfaces/IIdentityResolver.sol";
import { ISupplierRegistry } from "../interfaces/ISupplierRegistry.sol";
import { IBuyerRegistry } from "../interfaces/IBuyerRegistry.sol";
import { ICarrierRegistry } from "../interfaces/ICarrierRegistry.sol";
import { IOrganizationRegistry } from "../interfaces/IOrganizationRegistry.sol";
import { Keys } from "../core/Keys.sol";

/// @title IdentityResolver
/// @notice Unified read across the identity registries. Resolves the best-known role, org and
///         display name for an address by consulting the peer registries via the {AddressBook}.
/// @dev Read-only aggregator. Missing/unwired registries degrade gracefully (treated as absent)
///      so the resolver stays functional while sibling modules are still being deployed.
contract IdentityResolver is ProofChainAccess, IIdentityResolver {
    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IIdentityResolver
    function who(address account) external view returns (Identity memory) {
        ActorRole role = roleOf(account);

        string memory name;
        if (role == ActorRole.Supplier) {
            name = ISupplierRegistry(_addr(Keys.SUPPLIER_REGISTRY)).profileOf(account).name;
        } else if (role == ActorRole.Buyer) {
            name = IBuyerRegistry(_addr(Keys.BUYER_REGISTRY)).profileOf(account).name;
        } else if (role == ActorRole.Carrier) {
            name = ICarrierRegistry(_addr(Keys.CARRIER_REGISTRY)).profileOf(account).name;
        }

        bytes32 orgId;
        address orgRegistry = _addrOrZero(Keys.ORGANIZATION_REGISTRY);
        if (orgRegistry != address(0)) {
            orgId = IOrganizationRegistry(orgRegistry).orgOfMember(account);
        }

        return Identity({ role: role, orgId: orgId, name: name });
    }

    /// @inheritdoc IIdentityResolver
    /// @dev Resolution precedence is deterministic: Supplier > Buyer > Carrier.
    function roleOf(address account) public view returns (ActorRole) {
        address supplierRegistry = _addrOrZero(Keys.SUPPLIER_REGISTRY);
        if (supplierRegistry != address(0) && ISupplierRegistry(supplierRegistry).isSupplier(account)) {
            return ActorRole.Supplier;
        }

        address buyerRegistry = _addrOrZero(Keys.BUYER_REGISTRY);
        if (buyerRegistry != address(0) && IBuyerRegistry(buyerRegistry).isBuyer(account)) {
            return ActorRole.Buyer;
        }

        address carrierRegistry = _addrOrZero(Keys.CARRIER_REGISTRY);
        if (carrierRegistry != address(0) && ICarrierRegistry(carrierRegistry).isCarrier(account)) {
            return ActorRole.Carrier;
        }

        return ActorRole.Unknown;
    }
}
