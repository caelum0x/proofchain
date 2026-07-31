// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { ProposalRegistry } from "../../src/governance/ProposalRegistry.sol";
import { IProposalRegistry } from "../../src/interfaces/IProposalRegistry.sol";

contract ProposalRegistryTest is Test {
    ProposalRegistry internal registry;

    address internal alice = address(0xA11);
    address internal bob = address(0xB0B);

    uint256 internal constant PROPOSAL_ID = 42;
    string internal constant URI = "ipfs://QmProposalMetadata";

    event ProposalDescribed(uint256 indexed proposalId, string uri, address indexed author);

    function setUp() public {
        registry = new ProposalRegistry();
    }

    function test_Describe_HappyPath() public {
        vm.expectEmit(true, true, false, true);
        emit ProposalDescribed(PROPOSAL_ID, URI, alice);
        vm.prank(alice);
        registry.describe(PROPOSAL_ID, URI);

        assertEq(registry.descriptionOf(PROPOSAL_ID), URI);
        assertEq(registry.authorOf(PROPOSAL_ID), alice);
        assertTrue(registry.isDescribed(PROPOSAL_ID));
    }

    function test_Describe_RevertsEmptyURI() public {
        vm.expectRevert(IProposalRegistry.EmptyURI.selector);
        vm.prank(alice);
        registry.describe(PROPOSAL_ID, "");
    }

    function test_Describe_RevertsAlreadyDescribed() public {
        vm.prank(alice);
        registry.describe(PROPOSAL_ID, URI);

        vm.expectRevert(abi.encodeWithSelector(IProposalRegistry.AlreadyDescribed.selector, PROPOSAL_ID));
        vm.prank(bob);
        registry.describe(PROPOSAL_ID, "ipfs://other");
    }

    function test_Describe_ImmutableAfterFirstWrite() public {
        vm.prank(alice);
        registry.describe(PROPOSAL_ID, URI);
        // Even the original author cannot overwrite.
        vm.expectRevert(abi.encodeWithSelector(IProposalRegistry.AlreadyDescribed.selector, PROPOSAL_ID));
        vm.prank(alice);
        registry.describe(PROPOSAL_ID, "ipfs://changed");
    }

    function test_UndescribedProposal_ReturnsEmpty() public view {
        assertEq(registry.descriptionOf(999), "");
        assertEq(registry.authorOf(999), address(0));
        assertFalse(registry.isDescribed(999));
    }
}
