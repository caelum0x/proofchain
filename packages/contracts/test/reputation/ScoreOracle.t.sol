// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ScoreOracle } from "../../src/reputation/ScoreOracle.sol";
import { ReputationEngine } from "../../src/reputation/ReputationEngine.sol";
import { IScoreOracle } from "../../src/interfaces/IScoreOracle.sol";
import { IKYCRegistry } from "../../src/interfaces/IKYCRegistry.sol";
import { MockKYCRegistry } from "./mocks/MockKYCRegistry.sol";

contract ScoreOracleTest is Test {
    AddressBook internal book;
    ReputationEngine internal rep;
    MockKYCRegistry internal kyc;
    ScoreOracle internal oracle;

    address internal admin = address(0xA11CE);
    address internal updater = address(0x0DA7E);
    address internal supplier = address(0xB0B);
    address internal stranger = address(0xDEAD);

    event GradeParamsUpdated(uint16 reputationWeightBps, uint16 kycWeightBps);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        rep = new ReputationEngine(address(book), admin);
        kyc = new MockKYCRegistry();
        oracle = new ScoreOracle(address(book), admin);
        rep.grantRole(Roles.REPUTATION_UPDATER_ROLE, updater);
        book.setAddress(Keys.REPUTATION_ENGINE, address(rep));
        book.setAddress(Keys.KYC_REGISTRY, address(kyc));
        vm.stopPrank();
    }

    function _record(bool passed, uint16 score) internal {
        vm.prank(updater);
        rep.recordOutcome(supplier, passed, score);
    }

    // --- construction / params ---

    function test_Constructor_DefaultWeights() public view {
        assertEq(oracle.reputationWeightBps(), 7000);
        assertEq(oracle.kycWeightBps(), 3000);
    }

    function test_SetGradeParams_HappyPath() public {
        vm.expectEmit(false, false, false, true);
        emit GradeParamsUpdated(5000, 5000);
        vm.prank(admin);
        oracle.setGradeParams(5000, 5000);
        assertEq(oracle.reputationWeightBps(), 5000);
        assertEq(oracle.kycWeightBps(), 5000);
    }

    function test_SetGradeParams_RevertsInvalidWeights() public {
        vm.prank(admin);
        vm.expectRevert(IScoreOracle.InvalidWeights.selector);
        oracle.setGradeParams(6000, 5000); // sum 11000 != 10000
    }

    function test_SetGradeParams_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        oracle.setGradeParams(5000, 5000);
    }

    // --- gradeOf ---

    function test_GradeOf_UngradedWithoutHistory() public view {
        assertEq(oracle.gradeOf(supplier), 0);
    }

    function test_GradeOf_ZeroAddressIsUngraded() public view {
        assertEq(oracle.gradeOf(address(0)), 0);
    }

    function test_GradeOf_TopGradeForHighScoreAndKyc() public {
        _record(true, 9600);
        _record(true, 9600);
        vm.prank(admin);
        kyc.setKyc(supplier, IKYCRegistry.KycLevel.Enhanced);
        // repComponent = (9600 + 10000)/2 = 9800; kyc = 10000
        // composite = (9800*7000 + 10000*3000)/10000 = 9860 -> grade 1
        assertEq(oracle.gradeOf(supplier), 1);
    }

    function test_GradeOf_WorstGradeForLowScoreNoKyc() public {
        _record(false, 1000);
        _record(false, 1000);
        // repComponent = (1000 + 0)/2 = 500; kyc = 0; composite = 350 -> grade 7
        assertEq(oracle.gradeOf(supplier), 7);
    }

    function test_GradeOf_MidGrade() public {
        _record(true, 8000);
        _record(true, 8000);
        vm.prank(admin);
        kyc.setKyc(supplier, IKYCRegistry.KycLevel.Verified);
        // repComponent = (8000 + 10000)/2 = 9000; kyc = 2/3*10000 = 6666
        // composite = (9000*7000 + 6666*3000)/10000 = 8299 -> grade 2
        assertEq(oracle.gradeOf(supplier), 2);
    }

    function test_GradeOf_OptionalKycUnset() public {
        // A fresh oracle whose AddressBook has no KYC_REGISTRY key uses a zero KYC component.
        vm.startPrank(admin);
        AddressBook book2 = new AddressBook(admin);
        ReputationEngine rep2 = new ReputationEngine(address(book2), admin);
        rep2.grantRole(Roles.REPUTATION_UPDATER_ROLE, updater);
        book2.setAddress(Keys.REPUTATION_ENGINE, address(rep2));
        ScoreOracle oracle2 = new ScoreOracle(address(book2), admin);
        vm.stopPrank();

        vm.prank(updater);
        rep2.recordOutcome(supplier, true, 9600);
        vm.prank(updater);
        rep2.recordOutcome(supplier, true, 9600);
        // repComponent = 9800; kyc component = 0
        // composite = (9800*7000)/10000 = 6860 -> grade 4 (>=5500)
        assertEq(oracle2.gradeOf(supplier), 4);
    }

    function test_GradeOf_ReputationOnlyWeighting() public {
        vm.prank(admin);
        oracle.setGradeParams(10_000, 0);
        _record(true, 9600);
        _record(true, 9600);
        // composite == repComponent == 9800 -> grade 1
        assertEq(oracle.gradeOf(supplier), 1);
    }
}
