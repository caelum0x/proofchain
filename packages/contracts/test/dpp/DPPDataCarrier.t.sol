// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { DigitalProductPassport } from "../../src/dpp/DigitalProductPassport.sol";
import { DPPDataCarrier } from "../../src/dpp/DPPDataCarrier.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IDPPDataCarrier } from "../../src/interfaces/IDPPDataCarrier.sol";

contract DPPDataCarrierTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    DigitalProductPassport internal dpp;
    DPPDataCarrier internal carrier;

    address internal admin = address(0xA11CE);
    address internal manufacturer = address(0xBEEF);
    address internal registrar = address(0xCAFE);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant CARRIER_A = keccak256("qr-A");
    bytes32 internal constant CARRIER_B = keccak256("qr-B");
    uint256 internal tokenId;

    event CarrierRegistered(bytes32 indexed carrierId, uint256 indexed tokenId, IDPPDataCarrier.CarrierType carrierType, string uri);
    event CarrierDeactivated(bytes32 indexed carrierId);
    event CarrierReplaced(uint256 indexed tokenId, bytes32 indexed oldCarrierId, bytes32 indexed newCarrierId);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        dpp = new DigitalProductPassport(address(book), admin);
        carrier = new DPPDataCarrier(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        book.setAddress(Keys.DIGITAL_PRODUCT_PASSPORT, address(dpp));
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerBatch(BATCH, keccak256("origin"), "ipfs://m");
        tokenId = dpp.issue(BATCH, keccak256("gtin"), manufacturer, "ipfs://doc");
        carrier.grantRole(Roles.REGISTRAR_ROLE, registrar);
        vm.stopPrank();
    }

    function test_Register_AndResolve() public {
        vm.expectEmit(true, true, false, true, address(carrier));
        emit CarrierRegistered(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "https://id.gs1/01/x");
        vm.prank(manufacturer);
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "https://id.gs1/01/x");

        assertEq(carrier.resolve(CARRIER_A), tokenId);
        assertEq(carrier.activeCarrierOf(tokenId), CARRIER_A);
        assertTrue(carrier.carrierOf(CARRIER_A).active);
    }

    function test_Register_ByRegistrar() public {
        vm.prank(registrar);
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.NFC, "nfc://x");
        assertEq(carrier.resolve(CARRIER_A), tokenId);
    }

    function test_Deactivate() public {
        vm.startPrank(manufacturer);
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "u");
        vm.expectEmit(true, false, false, false, address(carrier));
        emit CarrierDeactivated(CARRIER_A);
        carrier.deactivate(CARRIER_A);
        vm.stopPrank();

        assertEq(carrier.activeCarrierOf(tokenId), bytes32(0));
        assertFalse(carrier.carrierOf(CARRIER_A).active);
    }

    function test_Register_AfterDeactivate() public {
        vm.startPrank(manufacturer);
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "u");
        carrier.deactivate(CARRIER_A);
        // Now a fresh carrier can be registered since none is active.
        carrier.registerCarrier(CARRIER_B, tokenId, IDPPDataCarrier.CarrierType.RFID, "r");
        vm.stopPrank();
        assertEq(carrier.activeCarrierOf(tokenId), CARRIER_B);
    }

    function test_Replace() public {
        vm.startPrank(manufacturer);
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "u");

        vm.expectEmit(true, true, true, false, address(carrier));
        emit CarrierReplaced(tokenId, CARRIER_A, CARRIER_B);
        carrier.replaceCarrier(CARRIER_A, CARRIER_B, IDPPDataCarrier.CarrierType.DataMatrix, "dm");
        vm.stopPrank();

        assertFalse(carrier.carrierOf(CARRIER_A).active);
        assertEq(carrier.activeCarrierOf(tokenId), CARRIER_B);
        assertEq(carrier.resolve(CARRIER_B), tokenId);
    }

    function test_RevertWhen_ResolveInactive() public {
        vm.startPrank(manufacturer);
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "u");
        carrier.deactivate(CARRIER_A);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(IDPPDataCarrier.CarrierInactive.selector, CARRIER_A));
        carrier.resolve(CARRIER_A);
    }

    function test_RevertWhen_ResolveUnknown() public {
        vm.expectRevert(abi.encodeWithSelector(IDPPDataCarrier.UnknownCarrier.selector, CARRIER_A));
        carrier.resolve(CARRIER_A);
    }

    function test_RevertWhen_DuplicateCarrierId() public {
        vm.startPrank(manufacturer);
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "u");
        carrier.deactivate(CARRIER_A);
        // Re-using the same carrier id is rejected even after deactivation.
        vm.expectRevert(abi.encodeWithSelector(IDPPDataCarrier.CarrierExists.selector, CARRIER_A));
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "u");
        vm.stopPrank();
    }

    function test_RevertWhen_SecondActiveCarrier() public {
        vm.startPrank(manufacturer);
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "u");
        // A passport may only have one active carrier at a time.
        vm.expectRevert(abi.encodeWithSelector(IDPPDataCarrier.CarrierExists.selector, CARRIER_A));
        carrier.registerCarrier(CARRIER_B, tokenId, IDPPDataCarrier.CarrierType.NFC, "n");
        vm.stopPrank();
    }

    function test_RevertWhen_DeactivateUnknown() public {
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(IDPPDataCarrier.UnknownCarrier.selector, CARRIER_A));
        carrier.deactivate(CARRIER_A);
    }

    function test_RevertWhen_DeactivateInactive() public {
        vm.startPrank(manufacturer);
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "u");
        carrier.deactivate(CARRIER_A);
        vm.expectRevert(abi.encodeWithSelector(IDPPDataCarrier.CarrierInactive.selector, CARRIER_A));
        carrier.deactivate(CARRIER_A);
        vm.stopPrank();
    }

    function test_RevertWhen_NotAuthorized() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IDPPDataCarrier.NotAuthorized.selector, tokenId));
        carrier.registerCarrier(CARRIER_A, tokenId, IDPPDataCarrier.CarrierType.QRCode, "u");
    }

    function test_RevertWhen_UnknownPassport() public {
        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(IDPPDataCarrier.UnknownPassport.selector, uint256(99)));
        carrier.registerCarrier(CARRIER_A, 99, IDPPDataCarrier.CarrierType.QRCode, "u");
    }

    function test_RevertWhen_ReplaceUnknownOld() public {
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(IDPPDataCarrier.UnknownCarrier.selector, CARRIER_A));
        carrier.replaceCarrier(CARRIER_A, CARRIER_B, IDPPDataCarrier.CarrierType.QRCode, "u");
    }
}
