// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IERC1155Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { Roles } from "../../src/core/Roles.sol";
import { RenewableEnergyCertificate } from "../../src/energy/RenewableEnergyCertificate.sol";
import { IRenewableEnergyCertificate } from "../../src/interfaces/IRenewableEnergyCertificate.sol";

contract RenewableEnergyCertificateTest is Test {
    AddressBook internal book;
    RenewableEnergyCertificate internal rec;

    address internal admin = address(0xA11CE);
    address internal certifier = address(0xC0DE);
    address internal minter = address(0x515E);
    address internal alice = address(0xA71CE);
    address internal bob = address(0xB0B);
    address internal stranger = address(0xDEAD);

    uint256 internal constant TOKEN = 2024_0001;
    bytes32 internal constant FACILITY = keccak256("solar-farm-1");
    bytes32 internal constant BENEFICIARY = keccak256("acme-corp");

    event CertificateIssued(
        uint256 indexed tokenId, bytes32 indexed facilityId, IRenewableEnergyCertificate.EnergySource source, uint16 vintageYear, uint256 mwh
    );
    event CertificateRetired(address indexed account, uint256 indexed tokenId, uint256 mwh, bytes32 beneficiary);

    function setUp() public {
        book = new AddressBook(admin);
        rec = new RenewableEnergyCertificate(address(book), admin, "ipfs://rec/{id}");

        vm.startPrank(admin);
        rec.grantRole(Roles.CERTIFIER_ROLE, certifier);
        rec.grantRole(Roles.MINTER_ROLE, minter);
        vm.stopPrank();
    }

    function _register() internal {
        vm.prank(certifier);
        rec.registerClass(TOKEN, FACILITY, IRenewableEnergyCertificate.EnergySource.Solar, 2024);
    }

    // ------------------------------------------------------------- registerClass

    function test_RegisterClass_Happy() public {
        _register();
        IRenewableEnergyCertificate.Certificate memory c = rec.certificateOf(TOKEN);
        assertEq(c.tokenId, TOKEN);
        assertEq(c.facilityId, FACILITY);
        assertEq(uint8(c.source), uint8(IRenewableEnergyCertificate.EnergySource.Solar));
        assertEq(c.vintageYear, 2024);
        assertEq(c.issuedMwh, 0);
        assertEq(c.retiredMwh, 0);
    }

    function test_Revert_RegisterClass_Exists() public {
        _register();
        vm.prank(certifier);
        vm.expectRevert(abi.encodeWithSelector(IRenewableEnergyCertificate.CertificateExists.selector, TOKEN));
        rec.registerClass(TOKEN, FACILITY, IRenewableEnergyCertificate.EnergySource.Wind, 2024);
    }

    function test_Revert_RegisterClass_NotCertifier() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CERTIFIER_ROLE)
        );
        rec.registerClass(TOKEN, FACILITY, IRenewableEnergyCertificate.EnergySource.Solar, 2024);
    }

    // ------------------------------------------------------------- issue

    function test_Issue_Happy() public {
        _register();
        vm.expectEmit(true, true, false, true, address(rec));
        emit CertificateIssued(TOKEN, FACILITY, IRenewableEnergyCertificate.EnergySource.Solar, 2024, 500);
        vm.prank(minter);
        rec.issue(alice, TOKEN, 500);

        assertEq(rec.balanceOf(alice, TOKEN), 500);
        assertEq(rec.certificateOf(TOKEN).issuedMwh, 500);
    }

    function test_Issue_Accumulates() public {
        _register();
        vm.startPrank(minter);
        rec.issue(alice, TOKEN, 500);
        rec.issue(bob, TOKEN, 300);
        vm.stopPrank();
        assertEq(rec.certificateOf(TOKEN).issuedMwh, 800);
        assertEq(rec.balanceOf(bob, TOKEN), 300);
    }

    function test_Revert_Issue_Unknown() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(IRenewableEnergyCertificate.UnknownCertificate.selector, TOKEN));
        rec.issue(alice, TOKEN, 500);
    }

    function test_Revert_Issue_ZeroAmount() public {
        _register();
        vm.prank(minter);
        vm.expectRevert(IRenewableEnergyCertificate.ZeroAmount.selector);
        rec.issue(alice, TOKEN, 0);
    }

    function test_Revert_Issue_ZeroAddress() public {
        _register();
        vm.prank(minter);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        rec.issue(address(0), TOKEN, 500);
    }

    function test_Revert_Issue_NotMinter() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.MINTER_ROLE)
        );
        rec.issue(alice, TOKEN, 500);
    }

    // ------------------------------------------------------------- retire

    function test_Retire_Happy() public {
        _register();
        vm.prank(minter);
        rec.issue(alice, TOKEN, 500);

        vm.expectEmit(true, true, false, true, address(rec));
        emit CertificateRetired(alice, TOKEN, 200, BENEFICIARY);
        vm.prank(alice);
        rec.retire(TOKEN, 200, BENEFICIARY);

        assertEq(rec.balanceOf(alice, TOKEN), 300);
        assertEq(rec.retiredOf(TOKEN), 200);
    }

    function test_Retire_AccumulatesMonotonic() public {
        _register();
        vm.prank(minter);
        rec.issue(alice, TOKEN, 500);
        vm.startPrank(alice);
        rec.retire(TOKEN, 100, BENEFICIARY);
        rec.retire(TOKEN, 150, BENEFICIARY);
        vm.stopPrank();
        assertEq(rec.retiredOf(TOKEN), 250);
        assertEq(rec.balanceOf(alice, TOKEN), 250);
    }

    function test_Revert_Retire_Insufficient() public {
        _register();
        vm.prank(minter);
        rec.issue(alice, TOKEN, 100);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IRenewableEnergyCertificate.InsufficientCertificates.selector, TOKEN, 200, 100)
        );
        rec.retire(TOKEN, 200, BENEFICIARY);
    }

    function test_Revert_Retire_ZeroAmount() public {
        _register();
        vm.prank(alice);
        vm.expectRevert(IRenewableEnergyCertificate.ZeroAmount.selector);
        rec.retire(TOKEN, 0, BENEFICIARY);
    }

    function test_Revert_Retire_Unknown() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRenewableEnergyCertificate.UnknownCertificate.selector, TOKEN));
        rec.retire(TOKEN, 100, BENEFICIARY);
    }

    // ------------------------------------------------------------- ERC1155 behavior

    function test_ERC1155_TransferMovesBalance() public {
        _register();
        vm.prank(minter);
        rec.issue(alice, TOKEN, 500);

        vm.prank(alice);
        rec.safeTransferFrom(alice, bob, TOKEN, 200, "");
        assertEq(rec.balanceOf(alice, TOKEN), 300);
        assertEq(rec.balanceOf(bob, TOKEN), 200);
    }

    function test_Revert_ERC1155_TransferWithoutApproval() public {
        _register();
        vm.prank(minter);
        rec.issue(alice, TOKEN, 500);

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IERC1155Errors.ERC1155MissingApprovalForAll.selector, stranger, alice)
        );
        rec.safeTransferFrom(alice, bob, TOKEN, 200, "");
    }

    function test_SupportsInterface() public view {
        assertTrue(rec.supportsInterface(0xd9b67a26)); // ERC1155
        assertTrue(rec.supportsInterface(0x7965db0b)); // IAccessControl
        assertTrue(rec.supportsInterface(0x01ffc9a7)); // ERC165
    }

    function test_Revert_CertificateOf_Unknown() public {
        vm.expectRevert(abi.encodeWithSelector(IRenewableEnergyCertificate.UnknownCertificate.selector, TOKEN));
        rec.certificateOf(TOKEN);
    }
}
