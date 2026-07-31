// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { DigitalProductPassport } from "../../src/dpp/DigitalProductPassport.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IDigitalProductPassport } from "../../src/interfaces/IDigitalProductPassport.sol";
import { IProvenanceRegistry } from "../../src/interfaces/IProvenanceRegistry.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IERC721Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract DigitalProductPassportTest is Test {
    AddressBook internal book;
    ProvenanceRegistry internal registry;
    DigitalProductPassport internal dpp;

    address internal admin = address(0xA11CE);
    address internal minter = address(0xB0B);
    address internal manufacturer = address(0xBEEF);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant GTIN = keccak256("gtin-1");
    bytes32 internal constant ORIGIN = keccak256("origin");
    string internal constant META = "ipfs://batch-meta";
    string internal constant DATA_URI = "ipfs://dpp-doc";

    event PassportIssued(uint256 indexed tokenId, bytes32 indexed batchId, address indexed manufacturer, bytes32 gtin);
    event DataURIUpdated(uint256 indexed tokenId, string dataURI);
    event StatusChanged(uint256 indexed tokenId, IDigitalProductPassport.PassportStatus status);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ProvenanceRegistry(admin);
        dpp = new DigitalProductPassport(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(registry));
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerBatch(BATCH, ORIGIN, META);
        dpp.grantRole(Roles.MINTER_ROLE, minter);
        vm.stopPrank();
    }

    function _issue() internal returns (uint256) {
        vm.prank(minter);
        return dpp.issue(BATCH, GTIN, manufacturer, DATA_URI);
    }

    function test_AdminRolesConfigured() public view {
        assertTrue(dpp.hasRole(dpp.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(dpp.hasRole(Roles.MINTER_ROLE, admin));
        assertTrue(dpp.hasRole(Roles.MINTER_ROLE, minter));
    }

    function test_Issue_HappyPath() public {
        vm.expectEmit(true, true, true, true, address(dpp));
        emit PassportIssued(1, BATCH, manufacturer, GTIN);

        uint256 tokenId = _issue();
        assertEq(tokenId, 1);
        assertEq(dpp.ownerOf(tokenId), manufacturer);
        assertEq(dpp.balanceOf(manufacturer), 1);
        assertEq(dpp.passportOfBatch(BATCH), tokenId);
        assertEq(dpp.tokenURI(tokenId), DATA_URI);

        IDigitalProductPassport.Passport memory p = dpp.passportOf(tokenId);
        assertEq(p.batchId, BATCH);
        assertEq(p.gtin, GTIN);
        assertEq(p.manufacturer, manufacturer);
        assertEq(uint8(p.status), uint8(IDigitalProductPassport.PassportStatus.Active));
    }

    function test_Issue_IncrementsTokenId() public {
        bytes32 batch2 = keccak256("batch-2");
        vm.startPrank(admin);
        registry.registerBatch(batch2, ORIGIN, META);
        vm.stopPrank();

        uint256 id1 = _issue();
        vm.prank(minter);
        uint256 id2 = dpp.issue(batch2, GTIN, manufacturer, DATA_URI);
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_RevertWhen_ZeroBatch() public {
        vm.prank(minter);
        vm.expectRevert(IDigitalProductPassport.ZeroBatch.selector);
        dpp.issue(bytes32(0), GTIN, manufacturer, DATA_URI);
    }

    function test_RevertWhen_ZeroManufacturer() public {
        vm.prank(minter);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        dpp.issue(BATCH, GTIN, address(0), DATA_URI);
    }

    function test_RevertWhen_BatchNotRegistered() public {
        bytes32 ghost = keccak256("ghost");
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(IProvenanceRegistry.UnknownBatch.selector, ghost));
        dpp.issue(ghost, GTIN, manufacturer, DATA_URI);
    }

    function test_RevertWhen_DuplicatePassport() public {
        _issue();
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(IDigitalProductPassport.PassportForBatchExists.selector, BATCH));
        dpp.issue(BATCH, GTIN, manufacturer, DATA_URI);
    }

    function test_RevertWhen_NonMinterIssues() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.MINTER_ROLE)
        );
        dpp.issue(BATCH, GTIN, manufacturer, DATA_URI);
    }

    function test_SetDataURI_ByManufacturer() public {
        uint256 tokenId = _issue();
        vm.expectEmit(true, false, false, true, address(dpp));
        emit DataURIUpdated(tokenId, "ipfs://updated");
        vm.prank(manufacturer);
        dpp.setDataURI(tokenId, "ipfs://updated");
        assertEq(dpp.tokenURI(tokenId), "ipfs://updated");
    }

    function test_SetDataURI_ByMinter() public {
        uint256 tokenId = _issue();
        vm.prank(minter);
        dpp.setDataURI(tokenId, "ipfs://minter");
        assertEq(dpp.tokenURI(tokenId), "ipfs://minter");
    }

    function test_RevertWhen_SetDataURIByStranger() public {
        uint256 tokenId = _issue();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IDigitalProductPassport.NotManufacturer.selector, tokenId));
        dpp.setDataURI(tokenId, "x");
    }

    function test_RevertWhen_SetDataURIUnknown() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(IDigitalProductPassport.UnknownPassport.selector, uint256(99)));
        dpp.setDataURI(99, "x");
    }

    function test_SetStatus_SuspendAndReactivate() public {
        uint256 tokenId = _issue();

        vm.expectEmit(true, false, false, true, address(dpp));
        emit StatusChanged(tokenId, IDigitalProductPassport.PassportStatus.Suspended);
        vm.prank(manufacturer);
        dpp.setStatus(tokenId, IDigitalProductPassport.PassportStatus.Suspended);
        assertEq(uint8(dpp.passportOf(tokenId).status), uint8(IDigitalProductPassport.PassportStatus.Suspended));

        vm.prank(manufacturer);
        dpp.setStatus(tokenId, IDigitalProductPassport.PassportStatus.Active);
        assertEq(uint8(dpp.passportOf(tokenId).status), uint8(IDigitalProductPassport.PassportStatus.Active));
    }

    function test_SetStatus_RecallThenRetire() public {
        uint256 tokenId = _issue();
        vm.startPrank(manufacturer);
        dpp.setStatus(tokenId, IDigitalProductPassport.PassportStatus.Recalled);
        dpp.setStatus(tokenId, IDigitalProductPassport.PassportStatus.Retired);
        vm.stopPrank();
        assertEq(uint8(dpp.passportOf(tokenId).status), uint8(IDigitalProductPassport.PassportStatus.Retired));
    }

    function test_RevertWhen_RetiredIsTerminal() public {
        uint256 tokenId = _issue();
        vm.startPrank(manufacturer);
        dpp.setStatus(tokenId, IDigitalProductPassport.PassportStatus.Retired);
        vm.expectRevert(
            abi.encodeWithSelector(
                IDigitalProductPassport.InvalidStatusTransition.selector,
                tokenId,
                IDigitalProductPassport.PassportStatus.Retired,
                IDigitalProductPassport.PassportStatus.Active
            )
        );
        dpp.setStatus(tokenId, IDigitalProductPassport.PassportStatus.Active);
        vm.stopPrank();
    }

    function test_RevertWhen_TransitionToNone() public {
        uint256 tokenId = _issue();
        vm.prank(manufacturer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IDigitalProductPassport.InvalidStatusTransition.selector,
                tokenId,
                IDigitalProductPassport.PassportStatus.Active,
                IDigitalProductPassport.PassportStatus.None
            )
        );
        dpp.setStatus(tokenId, IDigitalProductPassport.PassportStatus.None);
    }

    function test_RevertWhen_SameStatus() public {
        uint256 tokenId = _issue();
        vm.prank(manufacturer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IDigitalProductPassport.InvalidStatusTransition.selector,
                tokenId,
                IDigitalProductPassport.PassportStatus.Active,
                IDigitalProductPassport.PassportStatus.Active
            )
        );
        dpp.setStatus(tokenId, IDigitalProductPassport.PassportStatus.Active);
    }

    function test_Passport_IsTransferable() public {
        uint256 tokenId = _issue();
        vm.prank(manufacturer);
        dpp.transferFrom(manufacturer, stranger, tokenId);
        assertEq(dpp.ownerOf(tokenId), stranger);
    }

    function test_RevertWhen_TokenURIForNonexistent() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, uint256(42)));
        dpp.tokenURI(42);
    }

    function test_SupportsInterface() public view {
        assertTrue(dpp.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(dpp.supportsInterface(0x7965db0b)); // AccessControl
        assertTrue(dpp.supportsInterface(0x01ffc9a7)); // ERC165
    }
}
