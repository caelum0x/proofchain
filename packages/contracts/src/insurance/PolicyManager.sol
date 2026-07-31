// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IPolicyManager } from "../interfaces/IPolicyManager.sol";
import { IPremiumCalculator } from "../interfaces/IPremiumCalculator.sol";
import { IInsurancePool } from "../interfaces/IInsurancePool.sol";
import { IScoreOracle } from "../interfaces/IScoreOracle.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title PolicyManager
/// @notice Buyers/lenders purchase insurance policies covering a batch. Prices the premium off the
///         supplier's risk grade, routes the premium into the {InsurancePool} as capital, and
///         reserves coverage via {InsurancePool.underwrite}.
/// @dev One Active policy per batch. Peers are resolved via the AddressBook. `buyPolicy` is
///      `nonReentrant`; the InsurancePool performs the SafeERC20 premium pull. Ungraded suppliers
///      price at {DEFAULT_GRADE}.
contract PolicyManager is ProofChainAccess, ReentrancyGuard, IPolicyManager {
    /// @notice Grade applied when the ScoreOracle is unavailable or returns "ungraded" (0).
    uint8 public constant DEFAULT_GRADE = 4;

    /// @notice Extra: caller attempted an unaccepted settlement token.
    error TokenNotAccepted(address token);

    mapping(bytes32 => Policy) private _policies;
    mapping(bytes32 => bytes32) private _policyForBatch;
    uint256 private _nonce;

    /// @param addressBook_ Deployed AddressBook.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IPolicyManager
    function buyPolicy(bytes32 batchId, address token, uint256 coverage)
        external
        nonReentrant
        returns (bytes32 policyId)
    {
        _requireNotGloballyPaused();
        if (coverage == 0) revert ZeroCoverage();
        if (token == address(0)) revert TokenNotAccepted(address(0));
        _requireAccepted(token);

        bytes32 existing = _policyForBatch[batchId];
        if (existing != bytes32(0) && _policies[existing].state == PolicyState.Active) {
            revert PolicyExists(existing);
        }

        uint256 premium = _quotePremium(batchId, coverage);

        policyId = keccak256(abi.encode("Policy", batchId, msg.sender, coverage, _nonce));
        _nonce += 1;
        if (_policies[policyId].state != PolicyState.None) revert PolicyExists(policyId);

        // Persist BEFORE reserving so InsurancePool.underwrite can read the policy's token.
        _policies[policyId] = Policy({
            policyId: policyId,
            batchId: batchId,
            holder: msg.sender,
            token: token,
            coverage: coverage,
            premium: premium,
            issuedAt: uint64(block.timestamp),
            state: PolicyState.Active
        });
        _policyForBatch[batchId] = policyId;

        // Route the premium into the pool as backing capital, then reserve coverage.
        IInsurancePool pool = IInsurancePool(_addr(Keys.INSURANCE_POOL));
        if (premium > 0) {
            pool.depositFrom(token, msg.sender, premium);
        }
        pool.underwrite(policyId, coverage);

        emit PolicyIssued(policyId, batchId, msg.sender, coverage, premium);
    }

    /// @inheritdoc IPolicyManager
    function cancelPolicy(bytes32 policyId) external {
        Policy storage p = _policies[policyId];
        if (p.state == PolicyState.None) revert UnknownPolicy(policyId);
        if (msg.sender != p.holder) revert NotHolder(policyId);
        if (p.state != PolicyState.Active) revert UnknownPolicy(policyId);

        p.state = PolicyState.Cancelled;
        if (_policyForBatch[p.batchId] == policyId) {
            _policyForBatch[p.batchId] = bytes32(0);
        }
        emit PolicyCancelled(policyId);
    }

    /// @notice Mark a policy as Claimed after a claim pays out. ClaimsProcessor only.
    /// @dev Lifecycle transition driven by the claims module (not part of {IPolicyManager}).
    function markClaimed(bytes32 policyId) external override {
        if (msg.sender != _addr(Keys.CLAIMS_PROCESSOR)) revert NotHolder(policyId);
        Policy storage p = _policies[policyId];
        if (p.state == PolicyState.None) revert UnknownPolicy(policyId);
        p.state = PolicyState.Claimed;
        if (_policyForBatch[p.batchId] == policyId) {
            _policyForBatch[p.batchId] = bytes32(0);
        }
    }

    /// @inheritdoc IPolicyManager
    function policyOf(bytes32 policyId) external view returns (Policy memory) {
        return _policies[policyId];
    }

    /// @inheritdoc IPolicyManager
    function policyForBatch(bytes32 batchId) external view returns (bytes32) {
        return _policyForBatch[batchId];
    }

    /// @notice Quote the premium for `coverage` on `batchId` without buying (UI helper).
    function quote(bytes32 batchId, uint256 coverage) external view returns (uint256) {
        if (coverage == 0) revert ZeroCoverage();
        return _quotePremium(batchId, coverage);
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    /// @dev Resolve the supplier's grade (clamped to DEFAULT_GRADE when ungraded) and price it.
    function _quotePremium(bytes32 batchId, uint256 coverage) private view returns (uint256) {
        uint8 grade = _gradeForBatch(batchId);
        return IPremiumCalculator(_addr(Keys.PREMIUM_CALCULATOR)).premiumFor(coverage, grade);
    }

    /// @dev Grade of the batch's supplier via ScoreOracle; DEFAULT_GRADE when unwired/ungraded.
    function _gradeForBatch(bytes32 batchId) private view returns (uint8) {
        address oracle = _addrOrZero(Keys.SCORE_ORACLE);
        address prov = _addrOrZero(Keys.PROVENANCE_REGISTRY);
        if (oracle == address(0) || prov == address(0)) return DEFAULT_GRADE;

        address supplier = IProvenanceRegistry(prov).batchSupplier(batchId);
        if (supplier == address(0)) return DEFAULT_GRADE;

        uint8 grade = IScoreOracle(oracle).gradeOf(supplier);
        return grade == 0 ? DEFAULT_GRADE : grade;
    }

    /// @dev Enforce the StablecoinRegistry allowlist when wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
