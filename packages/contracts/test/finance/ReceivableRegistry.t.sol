// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { ReceivableRegistry } from "../../src/finance/ReceivableRegistry.sol";
import { IReceivableRegistry } from "../../src/interfaces/IReceivableRegistry.sol";
import { MockProvenance } from "./mocks/MockProvenance.sol";

contract ReceivableRegistryTest is Test {
    AddressBook internal book;
    ReceivableRegistry internal reg;
    MockProvenance internal prov;

    address internal admin = address(0xA11CE);
    address internal supplier = address(0xB0B);
    address internal obligor = address(0xB111);
    address internal token = address(0x5709);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");

    event ReceivableRegistered(
        bytes32 indexed batchId, uint256 faceValue, uint64 dueDate, address indexed obligor, address token
    );

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        reg = new ReceivableRegistry(address(book), admin);
        prov = new MockProvenance();
        book.setAddress(Keys.PROVENANCE_REGISTRY, address(prov));
        vm.stopPrank();

        prov.setBatch(BATCH, supplier);
    }

    function _due() internal view returns (uint64) {
        return uint64(block.timestamp + 30 days);
    }

    function test_Register_Happy() public {
        uint64 due = _due();
        vm.expectEmit(true, true, false, true);
        emit ReceivableRegistered(BATCH, 1_000e6, due, obligor, token);

        vm.prank(supplier);
        reg.register(BATCH, 1_000e6, due, obligor, token);

        assertTrue(reg.exists(BATCH));
        IReceivableRegistry.Terms memory t = reg.termsOf(BATCH);
        assertEq(t.faceValue, 1_000e6);
        assertEq(t.dueDate, due);
        assertEq(t.obligor, obligor);
        assertEq(t.token, token);
        assertTrue(t.exists);
    }

    function test_Register_AdminCanRegisterForAnyBatch() public {
        vm.prank(admin);
        reg.register(BATCH, 500e6, _due(), obligor, token);
        assertTrue(reg.exists(BATCH));
    }

    // --- reverts ---

    function test_Revert_ZeroAmount() public {
        vm.prank(supplier);
        vm.expectRevert(ReceivableRegistry.ZeroAmount.selector);
        reg.register(BATCH, 0, _due(), obligor, token);
    }

    function test_Revert_ZeroAddress_Obligor() public {
        vm.prank(supplier);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        reg.register(BATCH, 1e6, _due(), address(0), token);
    }

    function test_Revert_ZeroAddress_Token() public {
        vm.prank(supplier);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        reg.register(BATCH, 1e6, _due(), obligor, address(0));
    }

    function test_Revert_InvalidDueDate() public {
        vm.prank(supplier);
        vm.expectRevert(ReceivableRegistry.InvalidDueDate.selector);
        reg.register(BATCH, 1e6, uint64(block.timestamp), obligor, token);
    }

    function test_Revert_UnknownBatch() public {
        bytes32 unknown = keccak256("nope");
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(ReceivableRegistry.UnknownBatch.selector, unknown));
        reg.register(unknown, 1e6, _due(), obligor, token);
    }

    function test_Revert_NotBatchOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ReceivableRegistry.NotBatchOwner.selector, BATCH));
        reg.register(BATCH, 1e6, _due(), obligor, token);
    }

    function test_Revert_ReceivableExists() public {
        vm.startPrank(supplier);
        reg.register(BATCH, 1e6, _due(), obligor, token);
        vm.expectRevert(abi.encodeWithSelector(ReceivableRegistry.ReceivableExists.selector, BATCH));
        reg.register(BATCH, 1e6, _due(), obligor, token);
        vm.stopPrank();
    }

    function test_Revert_TermsOf_Unknown() public {
        vm.expectRevert(abi.encodeWithSelector(ReceivableRegistry.UnknownReceivable.selector, BATCH));
        reg.termsOf(BATCH);
    }
}
