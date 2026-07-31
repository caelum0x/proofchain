// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { EmissionsController } from "../../src/rewards/EmissionsController.sol";
import { IEmissionsController } from "../../src/interfaces/IEmissionsController.sol";

contract EmissionsControllerTest is Test {
    AddressBook internal book;
    EmissionsController internal emissions;

    address internal admin = address(0xA11CE);
    address internal governor = address(0x60E12);
    address internal stranger = address(0xDEAD);

    event EmissionRateSet(uint256 indexed epoch, uint256 rate);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        emissions = new EmissionsController(address(book), admin, governor);
        vm.stopPrank();
    }

    // --- construction ---

    function test_Constructor_InitialState() public view {
        assertEq(emissions.currentRate(), 0);
        assertEq(emissions.currentEpoch(), 0);
        assertTrue(emissions.hasRole(Roles.GOVERNOR_ROLE, governor));
        assertTrue(emissions.hasRole(emissions.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Constructor_RevertsZeroBook() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new EmissionsController(address(0), admin, governor);
    }

    function test_Constructor_RevertsZeroGovernor() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new EmissionsController(address(book), admin, address(0));
    }

    // --- setEmissionRate ---

    function test_SetEmissionRate_HappyPath() public {
        vm.expectEmit(true, false, false, true);
        emit EmissionRateSet(1, 1e15);
        vm.prank(governor);
        emissions.setEmissionRate(1e15);
        assertEq(emissions.currentRate(), 1e15);
        assertEq(emissions.currentEpoch(), 1);
    }

    function test_SetEmissionRate_IncrementsEpochEachCall() public {
        vm.startPrank(governor);
        emissions.setEmissionRate(1e15);
        emissions.setEmissionRate(2e15);
        emissions.setEmissionRate(0);
        vm.stopPrank();
        assertEq(emissions.currentEpoch(), 3);
        assertEq(emissions.currentRate(), 0); // zero rate is valid (pauses emissions)
    }

    function test_SetEmissionRate_RevertsAboveMax() public {
        uint256 tooHigh = emissions.MAX_EMISSION_RATE() + 1;
        vm.prank(governor);
        vm.expectRevert(abi.encodeWithSelector(IEmissionsController.InvalidRate.selector, tooHigh));
        emissions.setEmissionRate(tooHigh);
    }

    function test_SetEmissionRate_AllowsExactlyMax() public {
        uint256 maxRate = emissions.MAX_EMISSION_RATE();
        vm.prank(governor);
        emissions.setEmissionRate(maxRate);
        assertEq(emissions.currentRate(), maxRate);
    }

    function test_SetEmissionRate_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.GOVERNOR_ROLE
            )
        );
        emissions.setEmissionRate(1e15);
    }
}
