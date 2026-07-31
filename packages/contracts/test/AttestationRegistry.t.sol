// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { AttestationRegistry } from "../src/AttestationRegistry.sol";
import { ProvenanceRegistry } from "../src/ProvenanceRegistry.sol";

contract AttestationRegistryTest is Test {
    AttestationRegistry internal reg;
    ProvenanceRegistry internal prov;

    address internal admin = address(0xA11CE);
    address internal agent = address(0xA6E7);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant ORIGIN = keccak256("origin");
    bytes32 internal constant VHASH = keccak256("verdict");

    event Attested(
        bytes32 indexed batchId, uint16 score, bytes32 verdictHash, string verdictURI, address indexed agent
    );

    function setUp() public {
        vm.startPrank(admin);
        prov = new ProvenanceRegistry(admin);
        reg = new AttestationRegistry(admin, address(prov));
        reg.grantRole(reg.AGENT_ROLE(), agent);
        // Register the batch in provenance so attest() passes existence checks.
        prov.registerBatch(BATCH, ORIGIN, "ipfs://meta");
        vm.stopPrank();
    }

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(AttestationRegistry.ZeroAddress.selector);
        new AttestationRegistry(address(0), address(prov));
        vm.expectRevert(AttestationRegistry.ZeroAddress.selector);
        new AttestationRegistry(admin, address(0));
    }

    function test_Attest_RevertsUnknownBatch() public {
        bytes32 unknown = keccak256("nope");
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.UnknownBatch.selector, unknown));
        reg.attest(unknown, 9600, VHASH, "ipfs://verdict");
    }

    function test_AdminHasRole() public view {
        assertTrue(reg.hasRole(reg.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Attest_StoresAndEmits() public {
        vm.expectEmit(true, false, false, true);
        emit Attested(BATCH, 9600, VHASH, "ipfs://verdict", agent);

        vm.prank(agent);
        reg.attest(BATCH, 9600, VHASH, "ipfs://verdict");

        AttestationRegistry.Attestation memory a = reg.getAttestation(BATCH);
        assertEq(a.batchId, BATCH);
        assertEq(a.score, 9600);
        assertEq(a.verdictHash, VHASH);
        assertEq(a.verdictURI, "ipfs://verdict");
        assertEq(a.agent, agent);
        assertTrue(a.exists);
        assertTrue(reg.isAttested(BATCH));
        assertEq(reg.scoreOf(BATCH), 9600);
    }

    function test_Attest_AllowsMaxScore() public {
        vm.prank(agent);
        reg.attest(BATCH, 10_000, VHASH, "ipfs://verdict");
        assertEq(reg.scoreOf(BATCH), 10_000);
    }

    function test_Attest_RevertsInvalidScore() public {
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.InvalidScore.selector, uint16(10_001)));
        reg.attest(BATCH, 10_001, VHASH, "ipfs://verdict");
    }

    function test_Attest_RevertsAlreadyAttested() public {
        vm.startPrank(agent);
        reg.attest(BATCH, 9600, VHASH, "ipfs://verdict");
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.AlreadyAttested.selector, BATCH));
        reg.attest(BATCH, 5000, VHASH, "ipfs://verdict");
        vm.stopPrank();
    }

    function test_Attest_RevertsUnauthorized() public {
        bytes32 agentRole = reg.AGENT_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, agentRole)
        );
        reg.attest(BATCH, 9600, VHASH, "ipfs://verdict");
    }

    function test_ScoreOf_RevertsNotAttested() public {
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.NotAttested.selector, BATCH));
        reg.scoreOf(BATCH);
    }

    function test_IsAttested_FalseWhenAbsent() public view {
        assertFalse(reg.isAttested(BATCH));
    }
}
