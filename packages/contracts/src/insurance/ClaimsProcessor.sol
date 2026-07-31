// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IClaimsProcessor } from "../interfaces/IClaimsProcessor.sol";
import { IPolicyManager } from "../interfaces/IPolicyManager.sol";
import { IInsurancePool } from "../interfaces/IInsurancePool.sol";
import { ISettlementEscrow } from "../interfaces/ISettlementEscrow.sol";

/// @title ClaimsProcessor
/// @notice Files, adjudicates, and pays insurance claims on covered batches. A claim can only be
///         filed by the policy holder for a batch whose escrow deal has entered the Disputed state
///         (the on-chain "proven loss" precondition). Arbiters approve/reject; approved claims pay
///         from the {InsurancePool}.
/// @dev Peers resolved via the AddressBook. Payout is `nonReentrant`; the pool performs the
///      SafeERC20 movement. Loss precondition is enforced only when the escrow is wired.
contract ClaimsProcessor is ProofChainAccess, ReentrancyGuard, IClaimsProcessor {
    /// @notice Role that adjudicates (approves/rejects) filed claims.
    bytes32 public constant ARBITER_ROLE = Roles.ARBITER_ROLE;

    /// @notice Extra: only the policy holder may file a claim on their policy.
    error NotPolicyHolder(bytes32 policyId);
    /// @notice Extra: claim amount exceeds the policy's coverage.
    error AmountExceedsCoverage(uint256 amount, uint256 coverage);
    /// @notice Extra: the batch has not entered a Disputed (proven-loss) state.
    error LossNotProven(bytes32 batchId);
    /// @notice Extra: the referenced policy is not Active.
    error PolicyNotActive(bytes32 policyId);

    mapping(bytes32 => Claim) private _claims;
    uint256 private _nonce;

    /// @param addressBook_ Deployed AddressBook.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and ARBITER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.ARBITER_ROLE, admin);
    }

    /// @inheritdoc IClaimsProcessor
    function fileClaim(bytes32 policyId, uint256 amount) external nonReentrant returns (bytes32 claimId) {
        if (amount == 0) revert ZeroAmount();

        IPolicyManager.Policy memory p = IPolicyManager(_addr(Keys.POLICY_MANAGER)).policyOf(policyId);
        if (p.state == IPolicyManager.PolicyState.None) revert UnknownPolicy(policyId);
        if (p.state != IPolicyManager.PolicyState.Active) revert PolicyNotActive(policyId);
        if (msg.sender != p.holder) revert NotPolicyHolder(policyId);
        if (amount > p.coverage) revert AmountExceedsCoverage(amount, p.coverage);

        _requireLossProven(p.batchId);

        claimId = keccak256(abi.encode("Claim", policyId, msg.sender, amount, _nonce));
        _nonce += 1;
        if (_claims[claimId].state != ClaimState.None) revert ClaimExists(claimId);

        _claims[claimId] = Claim({
            claimId: claimId,
            policyId: policyId,
            claimant: msg.sender,
            amount: amount,
            state: ClaimState.Filed,
            filedAt: uint64(block.timestamp)
        });

        emit ClaimFiled(claimId, policyId, msg.sender, amount);
    }

    /// @inheritdoc IClaimsProcessor
    function approveClaim(bytes32 claimId) external onlyRole(Roles.ARBITER_ROLE) {
        Claim storage c = _claims[claimId];
        if (c.state == ClaimState.None) revert UnknownClaim(claimId);
        if (c.state != ClaimState.Filed) revert NotApproved(claimId);
        c.state = ClaimState.Approved;
        emit ClaimApproved(claimId, msg.sender);
    }

    /// @inheritdoc IClaimsProcessor
    function rejectClaim(bytes32 claimId) external onlyRole(Roles.ARBITER_ROLE) {
        Claim storage c = _claims[claimId];
        if (c.state == ClaimState.None) revert UnknownClaim(claimId);
        if (c.state != ClaimState.Filed) revert NotApproved(claimId);
        c.state = ClaimState.Rejected;
        emit ClaimRejected(claimId, msg.sender);
    }

    /// @inheritdoc IClaimsProcessor
    /// @dev Permissionless once approved: funds always go to the recorded claimant.
    function payout(bytes32 claimId) external nonReentrant {
        Claim storage c = _claims[claimId];
        if (c.state == ClaimState.None) revert UnknownClaim(claimId);
        if (c.state == ClaimState.Paid) revert AlreadyPaid(claimId);
        if (c.state != ClaimState.Approved) revert NotApproved(claimId);

        c.state = ClaimState.Paid;

        IInsurancePool(_addr(Keys.INSURANCE_POOL)).payout(c.policyId, c.claimant, c.amount);
        IPolicyManager(_addr(Keys.POLICY_MANAGER)).markClaimed(c.policyId);

        emit ClaimPaid(claimId, c.claimant, c.amount);
    }

    /// @inheritdoc IClaimsProcessor
    function claimOf(bytes32 claimId) external view returns (Claim memory) {
        return _claims[claimId];
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    /// @dev Require the batch's escrow deal to be Disputed. No-op when the escrow is not wired.
    function _requireLossProven(bytes32 batchId) private view {
        address escrow = _addrOrZero(Keys.SETTLEMENT_ESCROW);
        if (escrow == address(0)) return;
        ISettlementEscrow.Deal memory d = ISettlementEscrow(escrow).getDeal(batchId);
        if (d.state != ISettlementEscrow.DealState.Disputed) revert LossNotProven(batchId);
    }
}
