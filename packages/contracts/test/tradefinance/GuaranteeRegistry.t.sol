// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { GuaranteeRegistry } from "../../src/tradefinance/GuaranteeRegistry.sol";
import { IGuaranteeRegistry } from "../../src/interfaces/IGuaranteeRegistry.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract GuaranteeRegistryTest is Test {
    AddressBook internal book;
    GuaranteeRegistry internal gr;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE); // guarantor (UNDERWRITER_ROLE)
    address internal principal = address(0xABCD);
    address internal beneficiary = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant G = keccak256("g-1");
    uint256 internal constant AMOUNT = 1_000e6;
    uint64 internal expiry;

    function setUp() public {
        vm.prank(admin);
        book = new AddressBook(admin);
        gr = new GuaranteeRegistry(address(book), admin);
        usdc = new MockUSDC();

        usdc.mint(admin, AMOUNT * 10);
        vm.prank(admin);
        usdc.approve(address(gr), type(uint256).max);
        expiry = uint64(block.timestamp + 30 days);
    }

    function _issue() internal {
        vm.prank(admin);
        gr.issue(
            G,
            IGuaranteeRegistry.GuaranteeType.Performance,
            principal,
            beneficiary,
            address(usdc),
            AMOUNT,
            expiry,
            keccak256("terms")
        );
    }

    function test_Issue_EscrowsCollateral() public {
        _issue();
        IGuaranteeRegistry.Guarantee memory g = gr.guaranteeOf(G);
        assertEq(uint8(g.state), uint8(IGuaranteeRegistry.GuaranteeState.Issued));
        assertEq(g.guarantor, admin);
        assertEq(usdc.balanceOf(address(gr)), AMOUNT);
    }

    function test_Revert_Issue_NotUnderwriter() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.UNDERWRITER_ROLE)
        );
        gr.issue(
            G, IGuaranteeRegistry.GuaranteeType.Payment, principal, beneficiary, address(usdc), AMOUNT, expiry, bytes32(0)
        );
    }

    function test_CallAndPayOut() public {
        _issue();
        vm.prank(beneficiary);
        gr.call(G, "principal defaulted");
        assertEq(uint8(gr.guaranteeOf(G).state), uint8(IGuaranteeRegistry.GuaranteeState.Called));

        vm.prank(admin);
        gr.payOut(G);
        assertEq(uint8(gr.guaranteeOf(G).state), uint8(IGuaranteeRegistry.GuaranteeState.PaidOut));
        assertEq(usdc.balanceOf(beneficiary), AMOUNT);
        assertEq(usdc.balanceOf(address(gr)), 0);
    }

    function test_Revert_Call_NotBeneficiary() public {
        _issue();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IGuaranteeRegistry.NotBeneficiary.selector, G));
        gr.call(G, "x");
    }

    function test_Revert_PayOut_NotGuarantor() public {
        _issue();
        vm.prank(beneficiary);
        gr.call(G, "default");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IGuaranteeRegistry.NotGuarantor.selector, G));
        gr.payOut(G);
    }

    function test_Revert_PayOut_NotCalled() public {
        _issue();
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                IGuaranteeRegistry.InvalidState.selector,
                G,
                IGuaranteeRegistry.GuaranteeState.Called,
                IGuaranteeRegistry.GuaranteeState.Issued
            )
        );
        gr.payOut(G);
    }

    function test_Release_ReturnsCollateral() public {
        _issue();
        vm.prank(admin);
        gr.release(G);
        assertEq(uint8(gr.guaranteeOf(G).state), uint8(IGuaranteeRegistry.GuaranteeState.Released));
        assertEq(usdc.balanceOf(admin), AMOUNT * 10); // collateral back to guarantor
    }

    function test_Expire_ReturnsCollateral() public {
        _issue();
        vm.warp(expiry + 1);
        gr.expire(G);
        assertEq(uint8(gr.guaranteeOf(G).state), uint8(IGuaranteeRegistry.GuaranteeState.Expired));
        assertEq(usdc.balanceOf(admin), AMOUNT * 10);
    }

    function test_Revert_Call_AfterExpiry() public {
        _issue();
        vm.warp(expiry + 1);
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(IGuaranteeRegistry.GuaranteeExpired.selector, G));
        gr.call(G, "late");
    }

    function test_Revert_Expire_BeforeExpiry() public {
        _issue();
        vm.expectRevert(abi.encodeWithSelector(IGuaranteeRegistry.PastExpiry.selector, expiry));
        gr.expire(G);
    }
}
