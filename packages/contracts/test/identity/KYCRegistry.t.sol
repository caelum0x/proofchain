// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Pauser } from "../../src/core/Pauser.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { KYCRegistry } from "../../src/identity/KYCRegistry.sol";
import { IKYCRegistry } from "../../src/interfaces/IKYCRegistry.sol";
import { IPauser } from "../../src/interfaces/IPauser.sol";

contract KYCRegistryTest is Test {
    AddressBook internal book;
    KYCRegistry internal reg;

    address internal admin = address(0xA11CE);
    address internal provider = address(0x9309);
    address internal user = address(0xBEEF);

    event KycSet(address indexed account, IKYCRegistry.KycLevel level, address indexed provider);
    event KycRevoked(address indexed account, address indexed provider);

    function setUp() public {
        book = new AddressBook(admin);
        reg = new KYCRegistry(address(book), admin);
        // admin holds KYC_PROVIDER_ROLE by construction; grant a second provider.
        vm.prank(admin);
        reg.grantRole(Roles.KYC_PROVIDER_ROLE, provider);
    }

    function test_Constructor_RevertsZeroAddressBook() public {
        vm.expectRevert(IKYCRegistry.ZeroAddress.selector);
        new KYCRegistry(address(0), admin);
    }

    function test_Constructor_RevertsZeroAdmin() public {
        vm.expectRevert(IKYCRegistry.ZeroAddress.selector);
        new KYCRegistry(address(book), address(0));
    }

    function test_SetKyc_StoresAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit KycSet(user, IKYCRegistry.KycLevel.Verified, provider);
        vm.prank(provider);
        reg.setKyc(user, IKYCRegistry.KycLevel.Verified);

        IKYCRegistry.KycStatus memory s = reg.kycOf(user);
        assertEq(uint8(s.level), uint8(IKYCRegistry.KycLevel.Verified));
        assertEq(s.provider, provider);
        assertEq(s.updatedAt, uint64(block.timestamp));
        assertEq(uint8(reg.levelOf(user)), uint8(IKYCRegistry.KycLevel.Verified));
        assertTrue(reg.isVerified(user));
    }

    function test_IsVerified_FalseBelowVerified() public {
        vm.prank(provider);
        reg.setKyc(user, IKYCRegistry.KycLevel.Basic);
        assertFalse(reg.isVerified(user));
    }

    function test_IsVerified_TrueForEnhanced() public {
        vm.prank(provider);
        reg.setKyc(user, IKYCRegistry.KycLevel.Enhanced);
        assertTrue(reg.isVerified(user));
    }

    function test_SetKyc_RevertsZeroAddress() public {
        vm.prank(provider);
        vm.expectRevert(IKYCRegistry.ZeroAddress.selector);
        reg.setKyc(address(0), IKYCRegistry.KycLevel.Verified);
    }

    function test_SetKyc_RevertsUnauthorized() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, user, Roles.KYC_PROVIDER_ROLE
            )
        );
        reg.setKyc(user, IKYCRegistry.KycLevel.Verified);
    }

    function test_RevokeKyc_ResetsAndEmits() public {
        vm.startPrank(provider);
        reg.setKyc(user, IKYCRegistry.KycLevel.Enhanced);
        vm.expectEmit(true, true, true, true);
        emit KycRevoked(user, provider);
        reg.revokeKyc(user);
        vm.stopPrank();

        assertEq(uint8(reg.levelOf(user)), uint8(IKYCRegistry.KycLevel.None));
        assertFalse(reg.isVerified(user));
    }

    function test_RevokeKyc_RevertsUnauthorized() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, user, Roles.KYC_PROVIDER_ROLE
            )
        );
        reg.revokeKyc(user);
    }

    function test_AdminIsProviderByDefault() public {
        vm.prank(admin);
        reg.setKyc(user, IKYCRegistry.KycLevel.Verified);
        assertTrue(reg.isVerified(user));
    }

    function test_GlobalPause_BlocksSetKyc() public {
        Pauser pauser = new Pauser(admin);
        vm.startPrank(admin);
        book.setAddress(Keys.PAUSER, address(pauser));
        pauser.pause();
        vm.stopPrank();

        vm.prank(provider);
        vm.expectRevert(IPauser.EnforcedPause.selector);
        reg.setKyc(user, IKYCRegistry.KycLevel.Verified);
    }
}
