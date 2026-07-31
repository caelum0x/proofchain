// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ReputationEngine } from "../../src/reputation/ReputationEngine.sol";
import { IReputationEngine } from "../../src/interfaces/IReputationEngine.sol";

contract ReputationEngineTest is Test {
    AddressBook internal book;
    ReputationEngine internal rep;

    address internal admin = address(0xA11CE);
    address internal updater = address(0x0DA7E);
    address internal supplier = address(0xB0B);
    address internal stranger = address(0xDEAD);

    event OutcomeRecorded(address indexed supplier, bool passed, uint16 score, uint16 newAvgScoreBps);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        rep = new ReputationEngine(address(book), admin);
        rep.grantRole(Roles.REPUTATION_UPDATER_ROLE, updater);
        vm.stopPrank();
    }

    function _record(bool passed, uint16 score) internal {
        vm.prank(updater);
        rep.recordOutcome(supplier, passed, score);
    }

    // --- record ---

    function test_Record_FirstPassingOutcome() public {
        vm.expectEmit(true, false, false, true);
        emit OutcomeRecorded(supplier, true, 9000, 9000);
        _record(true, 9000);

        (uint16 avg, uint256 total, uint16 passRate, uint256 disputes) = rep.reputationOf(supplier);
        assertEq(avg, 9000);
        assertEq(total, 1);
        assertEq(passRate, 10_000);
        assertEq(disputes, 0);
    }

    function test_Record_FailingOutcomeCountsDispute() public {
        _record(false, 4000);
        (uint16 avg, uint256 total, uint16 passRate, uint256 disputes) = rep.reputationOf(supplier);
        assertEq(avg, 4000);
        assertEq(total, 1);
        assertEq(passRate, 0);
        assertEq(disputes, 1);
    }

    function test_Record_AggregatesAverageAndPassRate() public {
        _record(true, 9000); // avg 9000, pass 1/1
        _record(true, 7000); // avg 8000, pass 2/2
        _record(false, 2000); // avg 6000, pass 2/3

        (uint16 avg, uint256 total, uint16 passRate, uint256 disputes) = rep.reputationOf(supplier);
        assertEq(avg, 6000); // (9000+7000+2000)/3
        assertEq(total, 3);
        assertEq(passRate, 6666); // 2*10000/3
        assertEq(disputes, 1);
    }

    function test_Record_RevertsZeroSupplier() public {
        vm.prank(updater);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        rep.recordOutcome(address(0), true, 9000);
    }

    function test_Record_RevertsInvalidScore() public {
        vm.prank(updater);
        vm.expectRevert(abi.encodeWithSelector(IReputationEngine.InvalidScore.selector, uint16(10_001)));
        rep.recordOutcome(supplier, true, 10_001);
    }

    function test_Record_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.REPUTATION_UPDATER_ROLE
            )
        );
        rep.recordOutcome(supplier, true, 9000);
    }

    // --- views ---

    function test_ReputationOf_UngradedIsZero() public view {
        (uint16 avg, uint256 total, uint16 passRate, uint256 disputes) = rep.reputationOf(supplier);
        assertEq(avg, 0);
        assertEq(total, 0);
        assertEq(passRate, 0);
        assertEq(disputes, 0);
    }

    function test_Record_BoundaryScores() public {
        _record(true, 0);
        _record(true, 10_000);
        (uint16 avg,,,) = rep.reputationOf(supplier);
        assertEq(avg, 5000);
    }
}
