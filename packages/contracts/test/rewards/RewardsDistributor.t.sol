// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { RewardsDistributor } from "../../src/rewards/RewardsDistributor.sol";
import { IRewardsDistributor } from "../../src/interfaces/IRewardsDistributor.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { ReenterERC20 } from "./mocks/ReenterERC20.sol";

contract RewardsDistributorTest is Test {
    AddressBook internal book;
    RewardsDistributor internal dist;
    MockUSDC internal token;

    address internal admin = address(0xA11CE);
    address internal alice = address(0xA11);
    address internal bob = address(0xB0B);
    address internal stranger = address(0xDEAD);

    uint256 internal constant EPOCH = 1;
    uint256 internal constant ALICE_AMT = 300e6;
    uint256 internal constant BOB_AMT = 700e6;

    bytes32 internal root;
    bytes32 internal leafAlice;
    bytes32 internal leafBob;

    event RootSet(bytes32 indexed root, uint256 indexed epoch);
    event Claimed(address indexed account, uint256 indexed epoch, uint256 amount);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        dist = new RewardsDistributor(address(book), admin);
        vm.stopPrank();

        token = new MockUSDC();
        token.mint(address(dist), ALICE_AMT + BOB_AMT);

        // Two-leaf merkle tree, OZ double-hashed leaves + commutative (sorted) parent.
        leafAlice = keccak256(bytes.concat(keccak256(abi.encode(alice, ALICE_AMT))));
        leafBob = keccak256(bytes.concat(keccak256(abi.encode(bob, BOB_AMT))));
        root = leafAlice < leafBob
            ? keccak256(abi.encodePacked(leafAlice, leafBob))
            : keccak256(abi.encodePacked(leafBob, leafAlice));
    }

    function _proofForAlice() internal view returns (bytes32[] memory p) {
        p = new bytes32[](1);
        p[0] = leafBob;
    }

    function _proofForBob() internal view returns (bytes32[] memory p) {
        p = new bytes32[](1);
        p[0] = leafAlice;
    }

    function _setRoot() internal {
        vm.prank(admin);
        dist.setRoot(EPOCH, root, address(token));
    }

    // --- setRoot ---

    function test_SetRoot_HappyPath() public {
        vm.expectEmit(true, true, false, true);
        emit RootSet(root, EPOCH);
        vm.prank(admin);
        dist.setRoot(EPOCH, root, address(token));
        assertEq(dist.rootOf(EPOCH), root);
        assertEq(dist.tokenOf(EPOCH), address(token));
    }

    function test_SetRoot_RevertsUnauthorized() public {
        bytes32 _role = dist.DEFAULT_ADMIN_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        dist.setRoot(EPOCH, root, address(token));
    }

    function test_SetRoot_RevertsZeroRoot() public {
        vm.prank(admin);
        vm.expectRevert(RewardsDistributor.ZeroRoot.selector);
        dist.setRoot(EPOCH, bytes32(0), address(token));
    }

    function test_SetRoot_RevertsZeroToken() public {
        vm.prank(admin);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        dist.setRoot(EPOCH, root, address(0));
    }

    function test_SetRoot_RevertsOverwrite() public {
        _setRoot();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(RewardsDistributor.EpochAlreadySet.selector, EPOCH));
        dist.setRoot(EPOCH, root, address(token));
    }

    // --- claim ---

    function test_Claim_HappyPath() public {
        _setRoot();
        vm.expectEmit(true, true, false, true);
        emit Claimed(alice, EPOCH, ALICE_AMT);
        vm.prank(alice);
        dist.claim(EPOCH, ALICE_AMT, _proofForAlice());

        assertEq(token.balanceOf(alice), ALICE_AMT);
        assertTrue(dist.isClaimed(EPOCH, alice));
    }

    function test_Claim_BothRecipients() public {
        _setRoot();
        vm.prank(alice);
        dist.claim(EPOCH, ALICE_AMT, _proofForAlice());
        vm.prank(bob);
        dist.claim(EPOCH, BOB_AMT, _proofForBob());
        assertEq(token.balanceOf(alice), ALICE_AMT);
        assertEq(token.balanceOf(bob), BOB_AMT);
        assertEq(token.balanceOf(address(dist)), 0);
    }

    function test_Claim_RevertsUnknownEpoch() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRewardsDistributor.UnknownEpoch.selector, EPOCH));
        dist.claim(EPOCH, ALICE_AMT, _proofForAlice());
    }

    function test_Claim_RevertsAlreadyClaimed() public {
        _setRoot();
        vm.startPrank(alice);
        dist.claim(EPOCH, ALICE_AMT, _proofForAlice());
        vm.expectRevert(abi.encodeWithSelector(IRewardsDistributor.AlreadyClaimed.selector, alice, EPOCH));
        dist.claim(EPOCH, ALICE_AMT, _proofForAlice());
        vm.stopPrank();
    }

    function test_Claim_RevertsBadProof() public {
        _setRoot();
        // Alice presents Bob's proof for her own (wrong) leaf -> invalid.
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRewardsDistributor.InvalidProof.selector, alice));
        dist.claim(EPOCH, ALICE_AMT, _proofForBob());
    }

    function test_Claim_RevertsWrongAmount() public {
        _setRoot();
        // Correct proof shape but tampered amount -> leaf mismatch -> invalid proof.
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRewardsDistributor.InvalidProof.selector, alice));
        dist.claim(EPOCH, ALICE_AMT + 1, _proofForAlice());
    }

    function test_Claim_RevertsNonRecipient() public {
        _setRoot();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IRewardsDistributor.InvalidProof.selector, stranger));
        dist.claim(EPOCH, ALICE_AMT, _proofForAlice());
    }

    // --- reentrancy (money-movement safety) ---

    function test_Claim_ReentrancyBlocked() public {
        ReenterERC20 evil = new ReenterERC20();
        evil.mint(address(dist), ALICE_AMT);

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(alice, ALICE_AMT))));
        vm.prank(admin);
        dist.setRoot(2, leaf, address(evil)); // single-leaf tree: root == leaf, empty proof

        bytes32[] memory empty = new bytes32[](0);
        evil.arm(address(dist), abi.encodeWithSelector(dist.claim.selector, uint256(2), ALICE_AMT, empty));

        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        dist.claim(2, ALICE_AMT, empty);
    }
}
