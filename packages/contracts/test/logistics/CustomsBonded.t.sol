// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { CustomsBonded } from "../../src/logistics/CustomsBonded.sol";
import { ICustomsBonded } from "../../src/interfaces/ICustomsBonded.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract CustomsBondedTest is Test {
    AddressBook internal book;
    CustomsBonded internal cb;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal customs = address(0xC057);
    address internal principal = address(0x9111);
    address internal surety = address(0x5011E);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BOND = keccak256("bond-1");
    bytes32 internal constant DECL = keccak256("decl-1");
    bytes32 internal constant AUTH = keccak256("US-CBP");
    uint256 internal constant COVER = 1_000e6;

    event BondPosted(
        bytes32 indexed bondId, ICustomsBonded.BondType bondType, address indexed principal, address indexed surety, bytes32 authority, uint256 coverageAmount
    );
    event BondDrawn(bytes32 indexed bondId, bytes32 indexed declarationId, uint256 amount, uint256 drawnTotal);
    event BondReleased(bytes32 indexed bondId);
    event BondRevoked(bytes32 indexed bondId, bytes32 reason);

    function setUp() public {
        book = new AddressBook(admin);
        cb = new CustomsBonded(address(book), admin);
        usdc = new MockUSDC();
        vm.prank(admin);
        cb.grantRole(Roles.CUSTOMS_ROLE, customs);

        usdc.mint(surety, 100_000e6);
        vm.prank(surety);
        usdc.approve(address(cb), type(uint256).max);
    }

    function _post() internal {
        vm.prank(customs);
        cb.postBond(
            BOND,
            ICustomsBonded.BondType.Continuous,
            principal,
            surety,
            AUTH,
            address(usdc),
            COVER,
            uint64(block.timestamp),
            uint64(block.timestamp + 365 days)
        );
    }

    // ---------------------------------------------------------------- post

    function test_PostBond_PullsCollateral() public {
        uint256 suretyBefore = usdc.balanceOf(surety);
        vm.expectEmit(true, true, true, true);
        emit BondPosted(BOND, ICustomsBonded.BondType.Continuous, principal, surety, AUTH, COVER);
        _post();

        assertEq(usdc.balanceOf(surety), suretyBefore - COVER);
        assertEq(usdc.balanceOf(address(cb)), COVER);
        ICustomsBonded.CustomsBond memory b = cb.bondOf(BOND);
        assertEq(uint8(b.state), uint8(ICustomsBonded.BondState.Active));
        assertEq(b.coverageAmount, COVER);
        assertEq(cb.remainingCoverage(BOND), COVER);
    }

    function test_Revert_PostBond_NotCustoms() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CUSTOMS_ROLE)
        );
        cb.postBond(BOND, ICustomsBonded.BondType.Continuous, principal, surety, AUTH, address(usdc), COVER, uint64(block.timestamp), uint64(block.timestamp + 1 days));
    }

    function test_Revert_PostBond_ZeroCoverage() public {
        vm.prank(customs);
        vm.expectRevert(ICustomsBonded.ZeroCoverage.selector);
        cb.postBond(BOND, ICustomsBonded.BondType.Continuous, principal, surety, AUTH, address(usdc), 0, uint64(block.timestamp), uint64(block.timestamp + 1 days));
    }

    function test_Revert_PostBond_InvalidWindow() public {
        vm.prank(customs);
        vm.expectRevert(abi.encodeWithSelector(ICustomsBonded.InvalidWindow.selector, uint64(block.timestamp + 10), uint64(block.timestamp + 10)));
        cb.postBond(BOND, ICustomsBonded.BondType.Continuous, principal, surety, AUTH, address(usdc), COVER, uint64(block.timestamp + 10), uint64(block.timestamp + 10));
    }

    function test_Revert_PostBond_Exists() public {
        _post();
        vm.prank(customs);
        vm.expectRevert(abi.encodeWithSelector(ICustomsBonded.BondExists.selector, BOND));
        cb.postBond(BOND, ICustomsBonded.BondType.Continuous, principal, surety, AUTH, address(usdc), COVER, uint64(block.timestamp), uint64(block.timestamp + 1 days));
    }

    // ---------------------------------------------------------------- draw

    function test_Draw_PartialThenRelease() public {
        _post();
        uint256 customsBefore = usdc.balanceOf(customs);

        vm.expectEmit(true, true, false, true);
        emit BondDrawn(BOND, DECL, 400e6, 400e6);
        vm.prank(customs);
        cb.draw(BOND, DECL, 400e6);

        assertEq(usdc.balanceOf(customs), customsBefore + 400e6);
        assertEq(cb.remainingCoverage(BOND), COVER - 400e6);
        assertEq(uint8(cb.bondOf(BOND).state), uint8(ICustomsBonded.BondState.Drawn));

        // Release returns the remaining collateral to the surety.
        uint256 suretyBefore = usdc.balanceOf(surety);
        vm.prank(customs);
        cb.release(BOND);
        assertEq(usdc.balanceOf(surety), suretyBefore + (COVER - 400e6));
        assertEq(uint8(cb.bondOf(BOND).state), uint8(ICustomsBonded.BondState.Released));
        assertEq(cb.remainingCoverage(BOND), 0);
    }

    function test_Draw_FullExhausts() public {
        _post();
        vm.prank(customs);
        cb.draw(BOND, DECL, COVER);
        assertEq(uint8(cb.bondOf(BOND).state), uint8(ICustomsBonded.BondState.Exhausted));
        assertEq(cb.remainingCoverage(BOND), 0);
    }

    function test_Revert_Draw_CoverageExceeded() public {
        _post();
        vm.prank(customs);
        vm.expectRevert(abi.encodeWithSelector(ICustomsBonded.CoverageExceeded.selector, BOND, COVER + 1, COVER));
        cb.draw(BOND, DECL, COVER + 1);
    }

    function test_Revert_Draw_NotCustoms() public {
        _post();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CUSTOMS_ROLE)
        );
        cb.draw(BOND, DECL, 100e6);
    }

    function test_Revert_Draw_UnknownBond() public {
        vm.prank(customs);
        vm.expectRevert(abi.encodeWithSelector(ICustomsBonded.UnknownBond.selector, BOND));
        cb.draw(BOND, DECL, 100e6);
    }

    // ---------------------------------------------------------------- revoke

    function test_Revoke_ReturnsCollateral() public {
        _post();
        vm.prank(customs);
        cb.draw(BOND, DECL, 200e6);

        uint256 suretyBefore = usdc.balanceOf(surety);
        vm.expectEmit(true, false, false, true);
        emit BondRevoked(BOND, bytes32("fraud"));
        vm.prank(customs);
        cb.revoke(BOND, bytes32("fraud"));

        assertEq(usdc.balanceOf(surety), suretyBefore + (COVER - 200e6));
        assertEq(uint8(cb.bondOf(BOND).state), uint8(ICustomsBonded.BondState.Revoked));
    }

    function test_Revert_Release_AlreadyReleased() public {
        _post();
        vm.prank(customs);
        cb.release(BOND);
        vm.prank(customs);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICustomsBonded.InvalidState.selector, BOND, ICustomsBonded.BondState.Active, ICustomsBonded.BondState.Released
            )
        );
        cb.release(BOND);
    }
}
