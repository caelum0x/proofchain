// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { EscrowFactory } from "../../src/payments/EscrowFactory.sol";
import { IEscrowFactory } from "../../src/interfaces/IEscrowFactory.sol";
import { SettlementEscrow } from "../../src/SettlementEscrow.sol";
import { ProvenanceRegistry } from "../../src/ProvenanceRegistry.sol";
import { AttestationRegistry } from "../../src/AttestationRegistry.sol";
import { Keys } from "../../src/core/Keys.sol";

contract EscrowFactoryTest is Test {
    AddressBook internal book;
    EscrowFactory internal factory;
    ProvenanceRegistry internal prov;
    AttestationRegistry internal att;

    address internal admin = address(0xA11CE);
    address internal escrowAdmin = address(0xE5C0);
    address internal stranger = address(0xBEEF);

    bytes32 internal constant SALT = keccak256("deal-1");

    event EscrowCreated(bytes32 indexed salt, address indexed escrow, address indexed admin);

    function setUp() public {
        book = new AddressBook(admin);
        prov = new ProvenanceRegistry(admin);
        att = new AttestationRegistry(admin, address(prov));
        factory = new EscrowFactory(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(prov));
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        vm.stopPrank();
    }

    function test_CreateEscrow_DeploysWiredEscrow() public {
        vm.recordLogs();
        vm.prank(admin);
        address escrowAddr = factory.createEscrow(SALT, escrowAdmin);

        assertTrue(escrowAddr != address(0));
        assertEq(factory.escrowOf(SALT), escrowAddr);

        address[] memory all = factory.allEscrows();
        assertEq(all.length, 1);
        assertEq(all[0], escrowAddr);

        SettlementEscrow escrow = SettlementEscrow(escrowAddr);
        assertEq(address(escrow.attestations()), address(att));
        assertEq(address(escrow.provenance()), address(prov));
        assertTrue(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), escrowAdmin));
        assertEq(escrow.passThreshold(), 7000);
    }

    function test_CreateEscrow_EmitsEvent() public {
        // Address is deterministic (CREATE2) but computed off-chain is noisy; assert non-address topics.
        vm.expectEmit(true, false, true, false);
        emit EscrowCreated(SALT, address(0), escrowAdmin);
        vm.prank(admin);
        factory.createEscrow(SALT, escrowAdmin);
    }

    function test_CreateEscrow_RevertsAlreadyCreated() public {
        vm.startPrank(admin);
        factory.createEscrow(SALT, escrowAdmin);
        vm.expectRevert(abi.encodeWithSelector(IEscrowFactory.EscrowAlreadyCreated.selector, SALT));
        factory.createEscrow(SALT, escrowAdmin);
        vm.stopPrank();
    }

    function test_CreateEscrow_RevertsZeroAdmin() public {
        vm.prank(admin);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        factory.createEscrow(SALT, address(0));
    }

    function test_CreateEscrow_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        factory.createEscrow(SALT, escrowAdmin);
    }

    function test_CreateEscrow_DistinctSaltsDistinctEscrows() public {
        vm.startPrank(admin);
        address a = factory.createEscrow(keccak256("a"), escrowAdmin);
        address b = factory.createEscrow(keccak256("b"), escrowAdmin);
        vm.stopPrank();
        assertTrue(a != b);
        assertEq(factory.allEscrows().length, 2);
    }
}
