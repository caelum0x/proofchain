// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { LaborComplianceRegistry } from "../../src/workforce/LaborComplianceRegistry.sol";
import { ILaborComplianceRegistry } from "../../src/interfaces/ILaborComplianceRegistry.sol";

contract LaborComplianceRegistryTest is Test {
    AddressBook internal book;
    LaborComplianceRegistry internal reg;

    address internal admin = address(0xA11CE);
    address internal auditor = address(0xA0D17);
    address internal employer = address(0xE199);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant AUDIT = keccak256("audit-1");
    bytes32 internal constant STANDARD = bytes32("SA8000");
    bytes32 internal constant F1 = keccak256("finding-1");
    bytes32 internal constant F2 = keccak256("finding-2");
    bytes32 internal constant DETAILS = keccak256("details");
    uint64 internal dueBy;

    function setUp() public {
        dueBy = uint64(block.timestamp + 60 days);
        vm.startPrank(admin);
        book = new AddressBook(admin);
        reg = new LaborComplianceRegistry(address(book), admin);
        reg.grantRole(Roles.INSPECTOR_ROLE, auditor);
        vm.stopPrank();
    }

    function _open() internal {
        vm.prank(auditor);
        reg.openAudit(AUDIT, employer, STANDARD);
    }

    function _record(bytes32 id, ILaborComplianceRegistry.Severity sev) internal {
        vm.prank(auditor);
        reg.recordFinding(AUDIT, id, sev, DETAILS, dueBy);
    }

    function test_OpenAudit_Happy_StandingCompliant() public {
        _open();
        ILaborComplianceRegistry.Audit memory a = reg.auditOf(AUDIT);
        assertEq(a.employer, employer);
        assertEq(a.auditor, auditor);
        assertEq(
            uint8(reg.standingOf(employer)), uint8(ILaborComplianceRegistry.ComplianceStanding.Compliant)
        );
    }

    function test_StandingUnknown_BeforeAudit() public view {
        assertEq(uint8(reg.standingOf(employer)), uint8(ILaborComplianceRegistry.ComplianceStanding.Unknown));
    }

    function test_Revert_OpenAudit_NotInspector() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.INSPECTOR_ROLE
            )
        );
        reg.openAudit(AUDIT, employer, STANDARD);
    }

    function test_Revert_OpenAudit_ZeroEmployer() public {
        vm.prank(auditor);
        vm.expectRevert(ILaborComplianceRegistry.ZeroEmployer.selector);
        reg.openAudit(AUDIT, address(0), STANDARD);
    }

    function test_Revert_OpenAudit_Exists() public {
        _open();
        vm.prank(auditor);
        vm.expectRevert(abi.encodeWithSelector(ILaborComplianceRegistry.AuditExists.selector, AUDIT));
        reg.openAudit(AUDIT, employer, STANDARD);
    }

    function test_CriticalFinding_NonCompliant() public {
        _open();
        _record(F1, ILaborComplianceRegistry.Severity.Critical);
        assertEq(
            uint8(reg.standingOf(employer)), uint8(ILaborComplianceRegistry.ComplianceStanding.NonCompliant)
        );
        ILaborComplianceRegistry.Audit memory a = reg.auditOf(AUDIT);
        assertEq(a.findingCount, 1);
        assertEq(a.openCount, 1);
    }

    function test_MajorFinding_Watch() public {
        _open();
        _record(F1, ILaborComplianceRegistry.Severity.Major);
        assertEq(uint8(reg.standingOf(employer)), uint8(ILaborComplianceRegistry.ComplianceStanding.Watch));
    }

    function test_MinorFinding_StaysCompliant() public {
        _open();
        _record(F1, ILaborComplianceRegistry.Severity.Minor);
        assertEq(
            uint8(reg.standingOf(employer)), uint8(ILaborComplianceRegistry.ComplianceStanding.Compliant)
        );
    }

    function test_ResolveCritical_BackToCompliant() public {
        _open();
        _record(F1, ILaborComplianceRegistry.Severity.Critical);
        vm.prank(auditor);
        reg.resolveFinding(F1);
        assertEq(
            uint8(reg.standingOf(employer)), uint8(ILaborComplianceRegistry.ComplianceStanding.Compliant)
        );
        assertEq(uint8(reg.findingOf(F1).state), uint8(ILaborComplianceRegistry.FindingState.Resolved));
        assertEq(reg.auditOf(AUDIT).openCount, 0);
    }

    function test_CriticalOverridesMajor() public {
        _open();
        _record(F1, ILaborComplianceRegistry.Severity.Major);
        _record(F2, ILaborComplianceRegistry.Severity.Critical);
        assertEq(
            uint8(reg.standingOf(employer)), uint8(ILaborComplianceRegistry.ComplianceStanding.NonCompliant)
        );
        // Resolving the critical drops back to Watch (major still open).
        vm.prank(auditor);
        reg.resolveFinding(F2);
        assertEq(uint8(reg.standingOf(employer)), uint8(ILaborComplianceRegistry.ComplianceStanding.Watch));
    }

    function test_StartRemediation_ByEmployer() public {
        _open();
        _record(F1, ILaborComplianceRegistry.Severity.Major);
        vm.prank(employer);
        reg.startRemediation(F1);
        assertEq(uint8(reg.findingOf(F1).state), uint8(ILaborComplianceRegistry.FindingState.Remediating));
        // Still counts as open toward standing.
        assertEq(uint8(reg.standingOf(employer)), uint8(ILaborComplianceRegistry.ComplianceStanding.Watch));
    }

    function test_WaiveFinding_ByInspector() public {
        _open();
        _record(F1, ILaborComplianceRegistry.Severity.Critical);
        vm.prank(auditor);
        reg.waiveFinding(F1, bytes32("accepted-risk"));
        assertEq(uint8(reg.findingOf(F1).state), uint8(ILaborComplianceRegistry.FindingState.Waived));
        assertEq(
            uint8(reg.standingOf(employer)), uint8(ILaborComplianceRegistry.ComplianceStanding.Compliant)
        );
    }

    function test_Revert_RecordFinding_NotAuditor() public {
        _open();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ILaborComplianceRegistry.NotAuditor.selector, AUDIT));
        reg.recordFinding(AUDIT, F1, ILaborComplianceRegistry.Severity.Minor, DETAILS, dueBy);
    }

    function test_Revert_RecordFinding_UnknownAudit() public {
        vm.prank(auditor);
        vm.expectRevert(abi.encodeWithSelector(ILaborComplianceRegistry.UnknownAudit.selector, AUDIT));
        reg.recordFinding(AUDIT, F1, ILaborComplianceRegistry.Severity.Minor, DETAILS, dueBy);
    }

    function test_Revert_RecordFinding_Duplicate() public {
        _open();
        _record(F1, ILaborComplianceRegistry.Severity.Minor);
        vm.prank(auditor);
        vm.expectRevert(abi.encodeWithSelector(ILaborComplianceRegistry.FindingExists.selector, F1));
        reg.recordFinding(AUDIT, F1, ILaborComplianceRegistry.Severity.Minor, DETAILS, dueBy);
    }

    function test_Revert_StartRemediation_Unknown() public {
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(ILaborComplianceRegistry.UnknownFinding.selector, F1));
        reg.startRemediation(F1);
    }

    function test_Revert_StartRemediation_WrongState() public {
        _open();
        _record(F1, ILaborComplianceRegistry.Severity.Minor);
        vm.prank(auditor);
        reg.resolveFinding(F1);
        vm.prank(employer);
        vm.expectRevert(
            abi.encodeWithSelector(
                ILaborComplianceRegistry.InvalidFindingState.selector,
                F1,
                ILaborComplianceRegistry.FindingState.Open,
                ILaborComplianceRegistry.FindingState.Resolved
            )
        );
        reg.startRemediation(F1);
    }

    function test_Revert_WaiveFinding_NotInspector() public {
        _open();
        _record(F1, ILaborComplianceRegistry.Severity.Minor);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.INSPECTOR_ROLE
            )
        );
        reg.waiveFinding(F1, bytes32("x"));
    }
}
