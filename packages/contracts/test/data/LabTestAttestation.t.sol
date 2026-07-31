// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { LabTestAttestation } from "../../src/data/LabTestAttestation.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ILabTestAttestation } from "../../src/interfaces/ILabTestAttestation.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract LabTestAttestationTest is Test {
    AddressBook internal book;
    LabTestAttestation internal lab;

    address internal admin = address(0xA11CE);
    address internal labA = address(0x1AB);
    address internal labB = address(0x1AC);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant T1 = keccak256("test-1");
    bytes32 internal constant T2 = keccak256("test-2");
    bytes32 internal constant LOT = keccak256("lot-1");
    bytes32 internal constant SAMPLE = keccak256("sample-1");
    bytes32 internal constant ANALYTE = keccak256("Pb");
    bytes32 internal constant METHOD = keccak256("ICP-MS");
    bytes32 internal constant REPORT = keccak256("report");

    event LabTestAttested(bytes32 indexed testId, bytes32 indexed lotId, address indexed lab, bytes32 analyte, ILabTestAttestation.Result result);
    event LabTestRevoked(bytes32 indexed testId, bytes32 reason);

    function setUp() public {
        book = new AddressBook(admin);
        lab = new LabTestAttestation(address(book), admin);
        vm.startPrank(admin);
        lab.grantRole(Roles.INSPECTOR_ROLE, labA);
        lab.grantRole(Roles.INSPECTOR_ROLE, labB);
        vm.stopPrank();
    }

    function _attest(bytes32 id, address who, ILabTestAttestation.Result r) internal {
        vm.prank(who);
        lab.attest(id, LOT, SAMPLE, ANALYTE, METHOD, 3, 10, 2, r, REPORT);
    }

    function test_Attest_HappyPath() public {
        vm.expectEmit(true, true, true, true, address(lab));
        emit LabTestAttested(T1, LOT, labA, ANALYTE, ILabTestAttestation.Result.Pass);
        _attest(T1, labA, ILabTestAttestation.Result.Pass);

        ILabTestAttestation.LabTest memory t = lab.testOf(T1);
        assertEq(t.lotId, LOT);
        assertEq(t.lab, labA);
        assertEq(t.measuredValue, int256(3));
        assertEq(t.limitValue, int256(10));
        assertEq(uint8(t.result), uint8(ILabTestAttestation.Result.Pass));
        assertEq(lab.testCount(LOT), 1);
    }

    function test_RevertWhen_NonLabAttests() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.INSPECTOR_ROLE)
        );
        lab.attest(T1, LOT, SAMPLE, ANALYTE, METHOD, 3, 10, 2, ILabTestAttestation.Result.Pass, REPORT);
    }

    function test_RevertWhen_ZeroLot() public {
        vm.prank(labA);
        vm.expectRevert(ILabTestAttestation.ZeroLot.selector);
        lab.attest(T1, bytes32(0), SAMPLE, ANALYTE, METHOD, 3, 10, 2, ILabTestAttestation.Result.Pass, REPORT);
    }

    function test_RevertWhen_DuplicateTest() public {
        _attest(T1, labA, ILabTestAttestation.Result.Pass);
        vm.prank(labA);
        vm.expectRevert(abi.encodeWithSelector(ILabTestAttestation.TestExists.selector, T1));
        lab.attest(T1, LOT, SAMPLE, ANALYTE, METHOD, 3, 10, 2, ILabTestAttestation.Result.Pass, REPORT);
    }

    function test_AllTestsPassing_RequiresAtLeastOne() public {
        assertFalse(lab.allTestsPassing(LOT));
        _attest(T1, labA, ILabTestAttestation.Result.Pass);
        assertTrue(lab.allTestsPassing(LOT));
    }

    function test_AllTestsPassing_FailsIfAnyFail() public {
        _attest(T1, labA, ILabTestAttestation.Result.Pass);
        _attest(T2, labB, ILabTestAttestation.Result.Fail);
        assertFalse(lab.allTestsPassing(LOT));
    }

    function test_AllTestsPassing_IgnoresRevoked() public {
        _attest(T1, labA, ILabTestAttestation.Result.Pass);
        _attest(T2, labB, ILabTestAttestation.Result.Fail);
        assertFalse(lab.allTestsPassing(LOT));

        // Revoking the failing test restores an all-passing lot.
        vm.prank(labB);
        lab.revoke(T2, keccak256("wrong sample"));
        assertTrue(lab.allTestsPassing(LOT));
    }

    function test_Revoke_ByIssuingLab() public {
        _attest(T1, labA, ILabTestAttestation.Result.Pass);
        vm.expectEmit(true, false, false, true, address(lab));
        emit LabTestRevoked(T1, keccak256("err"));
        vm.prank(labA);
        lab.revoke(T1, keccak256("err"));
        assertTrue(lab.testOf(T1).revoked);
    }

    function test_Revoke_ByAdmin() public {
        _attest(T1, labA, ILabTestAttestation.Result.Pass);
        vm.prank(admin);
        lab.revoke(T1, keccak256("fraud"));
        assertTrue(lab.testOf(T1).revoked);
    }

    function test_RevertWhen_RevokeByOtherLab() public {
        _attest(T1, labA, ILabTestAttestation.Result.Pass);
        vm.prank(labB);
        vm.expectRevert(abi.encodeWithSelector(ILabTestAttestation.NotLab.selector, T1));
        lab.revoke(T1, keccak256("x"));
    }

    function test_RevertWhen_RevokeTwice() public {
        _attest(T1, labA, ILabTestAttestation.Result.Pass);
        vm.startPrank(labA);
        lab.revoke(T1, keccak256("x"));
        vm.expectRevert(abi.encodeWithSelector(ILabTestAttestation.AlreadyRevoked.selector, T1));
        lab.revoke(T1, keccak256("y"));
        vm.stopPrank();
    }

    function test_RevertWhen_RevokeUnknown() public {
        vm.prank(labA);
        vm.expectRevert(abi.encodeWithSelector(ILabTestAttestation.UnknownTest.selector, T1));
        lab.revoke(T1, keccak256("x"));
    }

    function test_TestAt_ReturnsRecord() public {
        _attest(T1, labA, ILabTestAttestation.Result.Pass);
        _attest(T2, labB, ILabTestAttestation.Result.Fail);
        assertEq(lab.testAt(LOT, 0).testId, T1);
        assertEq(lab.testAt(LOT, 1).testId, T2);
    }
}
