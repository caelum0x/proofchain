// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { DigitalProductPassport } from "../../src/dpp/DigitalProductPassport.sol";
import { MaterialComposition } from "../../src/dpp/MaterialComposition.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IMaterialComposition } from "../../src/interfaces/IMaterialComposition.sol";

contract MaterialCompositionTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    DigitalProductPassport internal dpp;
    MaterialComposition internal comp;

    address internal admin = address(0xA11CE);
    address internal manufacturer = address(0xBEEF);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant STEEL = keccak256("steel");
    bytes32 internal constant PLASTIC = keccak256("plastic");
    uint256 internal tokenId;

    event MaterialAdded(uint256 indexed tokenId, bytes32 indexed materialCode, uint16 fractionBps, uint16 recycledContentBps, bool hazardous);
    event CompositionSealed(uint256 indexed tokenId, uint16 totalRecycledContentBps);
    event CompositionCleared(uint256 indexed tokenId);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        dpp = new DigitalProductPassport(address(book), admin);
        comp = new MaterialComposition(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        book.setAddress(Keys.DIGITAL_PRODUCT_PASSPORT, address(dpp));
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerBatch(BATCH, keccak256("origin"), "ipfs://m");
        tokenId = dpp.issue(BATCH, keccak256("gtin"), manufacturer, "ipfs://doc");
        vm.stopPrank();
    }

    function test_AddMaterial_ByManufacturer() public {
        vm.expectEmit(true, true, false, true, address(comp));
        emit MaterialAdded(tokenId, STEEL, 6000, 5000, false);
        vm.prank(manufacturer);
        comp.addMaterial(tokenId, STEEL, 6000, 5000, false);

        IMaterialComposition.Material[] memory mats = comp.materialsOf(tokenId);
        assertEq(mats.length, 1);
        assertEq(mats[0].fractionBps, 6000);
        assertEq(mats[0].recycledContentBps, 5000);
    }

    function test_SealAndWeightedRecycledContent() public {
        vm.startPrank(manufacturer);
        comp.addMaterial(tokenId, STEEL, 6000, 5000, false); // 60% @ 50% recycled
        comp.addMaterial(tokenId, PLASTIC, 4000, 2500, false); // 40% @ 25% recycled
        // weighted = (6000*5000 + 4000*2500)/10000 = (30_000_000 + 10_000_000)/10000 = 4000
        vm.expectEmit(true, false, false, true, address(comp));
        emit CompositionSealed(tokenId, 4000);
        comp.seal(tokenId);
        vm.stopPrank();

        assertEq(comp.recycledContentOf(tokenId), 4000);
        assertFalse(comp.hasHazardous(tokenId));
    }

    function test_HazardousFlag() public {
        vm.startPrank(manufacturer);
        comp.addMaterial(tokenId, STEEL, 10000, 0, true);
        vm.stopPrank();
        assertTrue(comp.hasHazardous(tokenId));
    }

    function test_Clear_ResetsUnsealed() public {
        vm.startPrank(manufacturer);
        comp.addMaterial(tokenId, STEEL, 6000, 5000, true);
        vm.expectEmit(true, false, false, false, address(comp));
        emit CompositionCleared(tokenId);
        comp.clear(tokenId);
        vm.stopPrank();

        assertEq(comp.materialsOf(tokenId).length, 0);
        assertFalse(comp.hasHazardous(tokenId));

        // Can re-enter after clear.
        vm.startPrank(manufacturer);
        comp.addMaterial(tokenId, PLASTIC, 10000, 1000, false);
        comp.seal(tokenId);
        vm.stopPrank();
        assertEq(comp.recycledContentOf(tokenId), 1000);
    }

    function test_RevertWhen_ZeroFraction() public {
        vm.prank(manufacturer);
        vm.expectRevert(IMaterialComposition.ZeroFraction.selector);
        comp.addMaterial(tokenId, STEEL, 0, 0, false);
    }

    function test_RevertWhen_FractionOverflow() public {
        vm.startPrank(manufacturer);
        comp.addMaterial(tokenId, STEEL, 7000, 0, false);
        vm.expectRevert(abi.encodeWithSelector(IMaterialComposition.FractionOverflow.selector, uint16(10500)));
        comp.addMaterial(tokenId, PLASTIC, 3500, 0, false);
        vm.stopPrank();
    }

    function test_RevertWhen_RecycledContentOverflow() public {
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(IMaterialComposition.FractionOverflow.selector, uint16(10001)));
        comp.addMaterial(tokenId, STEEL, 5000, 10001, false);
    }

    function test_RevertWhen_SealNotHundred() public {
        vm.startPrank(manufacturer);
        comp.addMaterial(tokenId, STEEL, 6000, 0, false);
        vm.expectRevert(abi.encodeWithSelector(IMaterialComposition.FractionNotHundred.selector, uint16(6000)));
        comp.seal(tokenId);
        vm.stopPrank();
    }

    function test_RevertWhen_AddAfterSeal() public {
        vm.startPrank(manufacturer);
        comp.addMaterial(tokenId, STEEL, 10000, 0, false);
        comp.seal(tokenId);
        vm.expectRevert(abi.encodeWithSelector(IMaterialComposition.AlreadySealed.selector, tokenId));
        comp.addMaterial(tokenId, PLASTIC, 1, 0, false);
        vm.stopPrank();
    }

    function test_RevertWhen_ClearAfterSeal() public {
        vm.startPrank(manufacturer);
        comp.addMaterial(tokenId, STEEL, 10000, 0, false);
        comp.seal(tokenId);
        vm.expectRevert(abi.encodeWithSelector(IMaterialComposition.AlreadySealed.selector, tokenId));
        comp.clear(tokenId);
        vm.stopPrank();
    }

    function test_RevertWhen_RecycledContentBeforeSeal() public {
        vm.prank(manufacturer);
        comp.addMaterial(tokenId, STEEL, 6000, 5000, false);
        vm.expectRevert(abi.encodeWithSelector(IMaterialComposition.NotSealed.selector, tokenId));
        comp.recycledContentOf(tokenId);
    }

    function test_RevertWhen_NotAuthorized() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IMaterialComposition.NotAuthorized.selector, tokenId));
        comp.addMaterial(tokenId, STEEL, 6000, 5000, false);
    }

    function test_RevertWhen_UnknownPassport() public {
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(IMaterialComposition.UnknownPassport.selector, uint256(99)));
        comp.addMaterial(99, STEEL, 6000, 5000, false);
    }

    function test_MinterCanEdit() public {
        // admin holds MINTER_ROLE by default.
        vm.prank(admin);
        comp.addMaterial(tokenId, STEEL, 10000, 3000, false);
        vm.prank(admin);
        comp.seal(tokenId);
        assertEq(comp.recycledContentOf(tokenId), 3000);
    }
}
