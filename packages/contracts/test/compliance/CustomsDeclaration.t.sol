// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { CustomsDeclaration } from "../../src/compliance/CustomsDeclaration.sol";
import { DutyAndTariffCalculator } from "../../src/compliance/DutyAndTariffCalculator.sol";
import { Treasury } from "../../src/payments/Treasury.sol";
import { StablecoinRegistry } from "../../src/payments/StablecoinRegistry.sol";
import { ICustomsDeclaration } from "../../src/interfaces/ICustomsDeclaration.sol";
import { IStablecoinRegistry } from "../../src/interfaces/IStablecoinRegistry.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract CustomsDeclarationTest is Test {
    AddressBook internal book;
    CustomsDeclaration internal customs;
    DutyAndTariffCalculator internal calc;
    Treasury internal treasury;
    StablecoinRegistry internal registry;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal customsOfficer = address(0xC05);
    address internal declarant = address(0xDEC);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant DECL = keccak256("decl-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant HS = bytes32("8703");
    bytes32 internal constant ORIGIN = bytes32("JP");
    bytes32 internal constant DEST = bytes32("DE");

    uint256 internal constant VALUE = 1_000e6;
    uint256 internal constant DUTY = 100e6; // 10% of value, no VAT/excise

    event Lodged(
        bytes32 indexed declarationId,
        bytes32 indexed batchId,
        address indexed declarant,
        bytes32 hsCode,
        uint256 customsValue
    );
    event Assessed(bytes32 indexed declarationId, uint256 dutyAssessed);
    event Paid(bytes32 indexed declarationId, uint256 amount);
    event Released(bytes32 indexed declarationId);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        customs = new CustomsDeclaration(address(book), admin);
        calc = new DutyAndTariffCalculator(address(book), admin);
        treasury = new Treasury(address(book), admin);
        registry = new StablecoinRegistry(address(book), admin);
        usdc = new MockUSDC();

        book.setAddress(Keys.DUTY_AND_TARIFF_CALCULATOR, address(calc));
        book.setAddress(Keys.TREASURY, address(treasury));
        book.setAddress(Keys.STABLECOIN_REGISTRY, address(registry));

        registry.addToken(address(usdc), 6);
        calc.setRate(HS, ORIGIN, DEST, 1000, 0, 0, false); // 10% duty
        customs.grantRole(Roles.CUSTOMS_ROLE, customsOfficer);
        vm.stopPrank();

        usdc.mint(declarant, DUTY);
        vm.prank(declarant);
        usdc.approve(address(customs), type(uint256).max);
    }

    function _lodge() internal {
        vm.prank(declarant);
        customs.lodge(DECL, BATCH, HS, ORIGIN, DEST, VALUE, address(usdc));
    }

    function _assess() internal {
        vm.prank(customsOfficer);
        customs.assess(DECL);
    }

    function test_FullFlow_LodgeAssessPayRelease() public {
        vm.expectEmit(true, true, true, true);
        emit Lodged(DECL, BATCH, declarant, HS, VALUE);
        _lodge();
        assertEq(uint8(customs.declarationOf(DECL).state), uint8(ICustomsDeclaration.DeclarationState.Lodged));

        vm.expectEmit(true, false, false, true);
        emit Assessed(DECL, DUTY);
        _assess();
        assertEq(customs.declarationOf(DECL).dutyAssessed, DUTY);

        vm.expectEmit(true, false, false, true);
        emit Paid(DECL, DUTY);
        vm.prank(declarant);
        customs.payDuty(DECL);

        // Duty routed into the Treasury's tracked balance.
        assertEq(treasury.balanceOf(address(usdc)), DUTY);
        assertEq(usdc.balanceOf(declarant), 0);
        assertEq(usdc.balanceOf(address(customs)), 0);

        vm.expectEmit(true, false, false, false);
        emit Released(DECL);
        vm.prank(customsOfficer);
        customs.release(DECL);
        assertTrue(customs.isReleased(DECL));
    }

    function test_Hold() public {
        _lodge();
        vm.prank(customsOfficer);
        customs.hold(DECL, "inspection");
        assertEq(uint8(customs.declarationOf(DECL).state), uint8(ICustomsDeclaration.DeclarationState.Held));
    }

    function test_Cancel_BeforePayment() public {
        _lodge();
        _assess();
        vm.prank(declarant);
        customs.cancel(DECL);
        assertEq(uint8(customs.declarationOf(DECL).state), uint8(ICustomsDeclaration.DeclarationState.Cancelled));
    }

    function test_Revert_Lodge_Exists() public {
        _lodge();
        vm.prank(declarant);
        vm.expectRevert(abi.encodeWithSelector(ICustomsDeclaration.DeclarationExists.selector, DECL));
        customs.lodge(DECL, BATCH, HS, ORIGIN, DEST, VALUE, address(usdc));
    }

    function test_Revert_Lodge_ZeroValue() public {
        vm.prank(declarant);
        vm.expectRevert(ICustomsDeclaration.ZeroValue.selector);
        customs.lodge(DECL, BATCH, HS, ORIGIN, DEST, 0, address(usdc));
    }

    function test_Revert_Lodge_TokenNotAccepted() public {
        MockUSDC other = new MockUSDC();
        vm.prank(declarant);
        vm.expectRevert(abi.encodeWithSelector(IStablecoinRegistry.TokenNotAccepted.selector, address(other)));
        customs.lodge(DECL, BATCH, HS, ORIGIN, DEST, VALUE, address(other));
    }

    function test_Revert_Assess_WrongState() public {
        _lodge();
        _assess();
        vm.prank(customsOfficer);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICustomsDeclaration.InvalidState.selector,
                DECL,
                ICustomsDeclaration.DeclarationState.Lodged,
                ICustomsDeclaration.DeclarationState.Assessed
            )
        );
        customs.assess(DECL);
    }

    function test_Revert_Assess_AccessControl() public {
        _lodge();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.CUSTOMS_ROLE
            )
        );
        customs.assess(DECL);
    }

    function test_Revert_PayDuty_NotDeclarant() public {
        _lodge();
        _assess();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ICustomsDeclaration.NotDeclarant.selector, DECL));
        customs.payDuty(DECL);
    }

    function test_Revert_PayDuty_NotAssessed() public {
        _lodge();
        vm.prank(declarant);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICustomsDeclaration.InvalidState.selector,
                DECL,
                ICustomsDeclaration.DeclarationState.Assessed,
                ICustomsDeclaration.DeclarationState.Lodged
            )
        );
        customs.payDuty(DECL);
    }

    function test_Revert_Release_NotPaid() public {
        _lodge();
        _assess();
        vm.prank(customsOfficer);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICustomsDeclaration.InvalidState.selector,
                DECL,
                ICustomsDeclaration.DeclarationState.Paid,
                ICustomsDeclaration.DeclarationState.Assessed
            )
        );
        customs.release(DECL);
    }

    function test_Revert_Cancel_AfterPaid() public {
        _lodge();
        _assess();
        vm.prank(declarant);
        customs.payDuty(DECL);
        vm.prank(declarant);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICustomsDeclaration.InvalidState.selector,
                DECL,
                ICustomsDeclaration.DeclarationState.Lodged,
                ICustomsDeclaration.DeclarationState.Paid
            )
        );
        customs.cancel(DECL);
    }
}
