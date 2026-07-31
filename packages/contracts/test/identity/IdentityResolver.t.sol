// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { SupplierRegistry } from "../../src/identity/SupplierRegistry.sol";
import { BuyerRegistry } from "../../src/identity/BuyerRegistry.sol";
import { CarrierRegistry } from "../../src/identity/CarrierRegistry.sol";
import { OrganizationRegistry } from "../../src/identity/OrganizationRegistry.sol";
import { IdentityResolver } from "../../src/identity/IdentityResolver.sol";
import { IIdentityResolver } from "../../src/interfaces/IIdentityResolver.sol";
import { IOrganizationRegistry } from "../../src/interfaces/IOrganizationRegistry.sol";

contract IdentityResolverTest is Test {
    AddressBook internal book;
    SupplierRegistry internal supplierReg;
    BuyerRegistry internal buyerReg;
    CarrierRegistry internal carrierReg;
    OrganizationRegistry internal orgReg;
    IdentityResolver internal resolver;

    address internal admin = address(0xA11CE);
    address internal supplier = address(0x5011D);
    address internal buyer = address(0xB0B);
    address internal carrier = address(0xCA44);
    address internal nobody = address(0xDEAD);

    bytes32 internal constant ORG = keccak256("acme-corp");

    function setUp() public {
        book = new AddressBook(admin);
        supplierReg = new SupplierRegistry(address(book), admin);
        buyerReg = new BuyerRegistry(address(book), admin);
        carrierReg = new CarrierRegistry(address(book), admin);
        orgReg = new OrganizationRegistry(address(book), admin);
        resolver = new IdentityResolver(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.SUPPLIER_REGISTRY, address(supplierReg));
        book.setAddress(Keys.BUYER_REGISTRY, address(buyerReg));
        book.setAddress(Keys.CARRIER_REGISTRY, address(carrierReg));
        book.setAddress(Keys.ORGANIZATION_REGISTRY, address(orgReg));
        vm.stopPrank();

        vm.prank(supplier);
        supplierReg.registerSupplier("Acme Foods", "ipfs://s");
        vm.prank(buyer);
        buyerReg.registerBuyer("MegaMart", "ipfs://b");
        vm.prank(carrier);
        carrierReg.registerCarrier("FastFreight", "ipfs://c");
    }

    function test_RoleOf_Supplier() public view {
        assertEq(uint8(resolver.roleOf(supplier)), uint8(IIdentityResolver.ActorRole.Supplier));
    }

    function test_RoleOf_Buyer() public view {
        assertEq(uint8(resolver.roleOf(buyer)), uint8(IIdentityResolver.ActorRole.Buyer));
    }

    function test_RoleOf_Carrier() public view {
        assertEq(uint8(resolver.roleOf(carrier)), uint8(IIdentityResolver.ActorRole.Carrier));
    }

    function test_RoleOf_UnknownForUnregistered() public view {
        assertEq(uint8(resolver.roleOf(nobody)), uint8(IIdentityResolver.ActorRole.Unknown));
    }

    function test_Who_ReturnsNameAndRole() public view {
        IIdentityResolver.Identity memory id = resolver.who(supplier);
        assertEq(uint8(id.role), uint8(IIdentityResolver.ActorRole.Supplier));
        assertEq(id.name, "Acme Foods");
        assertEq(id.orgId, bytes32(0));
    }

    function test_Who_IncludesOrgIdWhenMember() public {
        vm.prank(supplier);
        orgReg.registerOrg(ORG, "Acme", IOrganizationRegistry.OrgType.Supplier, "ipfs://o");

        IIdentityResolver.Identity memory id = resolver.who(supplier);
        assertEq(id.orgId, ORG);
        assertEq(uint8(id.role), uint8(IIdentityResolver.ActorRole.Supplier));
        assertEq(id.name, "Acme Foods");
    }

    function test_Who_UnknownAccount() public view {
        IIdentityResolver.Identity memory id = resolver.who(nobody);
        assertEq(uint8(id.role), uint8(IIdentityResolver.ActorRole.Unknown));
        assertEq(id.name, "");
        assertEq(id.orgId, bytes32(0));
    }

    function test_Precedence_SupplierBeatsBuyer() public {
        // Same account registered in both supplier and buyer registries.
        vm.prank(supplier);
        buyerReg.registerBuyer("Acme as buyer", "ipfs://sb");
        assertEq(uint8(resolver.roleOf(supplier)), uint8(IIdentityResolver.ActorRole.Supplier));
    }

    function test_GracefulDegradation_UnwiredRegistries() public {
        // A fresh resolver over an empty AddressBook resolves everything to Unknown.
        AddressBook emptyBook = new AddressBook(admin);
        IdentityResolver bare = new IdentityResolver(address(emptyBook), admin);
        assertEq(uint8(bare.roleOf(supplier)), uint8(IIdentityResolver.ActorRole.Unknown));

        IIdentityResolver.Identity memory id = bare.who(supplier);
        assertEq(uint8(id.role), uint8(IIdentityResolver.ActorRole.Unknown));
        assertEq(id.orgId, bytes32(0));
    }
}
