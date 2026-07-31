// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IReferralProgram } from "../interfaces/IReferralProgram.sol";

/// @title ReferralProgram
/// @notice Attributes new participants to their referrer and accrues a share of each referred
///         conversion's value as a claimable reward, paid in the PROOF governance token.
/// @dev Attribution is set once per referee (first-touch, immutable) via {refer}. Trusted
///      protocol contracts holding `CONVERSION_RECORDER_ROLE` (e.g. the {SettlementRouter}) call
///      {recordConversion} when a referee transacts, crediting `value * rewardBps / 10000` to the
///      referrer's pending balance. Referrers pull rewards under `nonReentrant` + `SafeERC20` from
///      this contract's pre-funded PROOF balance, resolved through the AddressBook.
contract ReferralProgram is ProofChainAccess, ReentrancyGuard, IReferralProgram {
    using SafeERC20 for IERC20;

    /// @notice Trusted recorders (settlement/router contracts, keepers) that can attest conversions.
    bytes32 public constant CONVERSION_RECORDER_ROLE = keccak256("CONVERSION_RECORDER_ROLE");

    /// @notice Basis-points denominator.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Share of conversion value paid to the referrer, in basis points.
    uint256 private _rewardBps;

    /// @notice referee => the referrer they were attributed to (zero if none).
    mapping(address => address) private _referrerOf;

    /// @notice referrer => claimable reward accrued from their referees' conversions.
    mapping(address => uint256) private _pending;

    error ZeroAmount();
    error InvalidBps(uint256 bps);

    event RewardBpsUpdated(uint256 oldBps, uint256 newBps);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE (tunes the reward rate, manages roles).
    /// @param rewardBps_ Initial referral reward rate in basis points (must be <= 10000).
    constructor(address addressBook_, address admin, uint256 rewardBps_) ProofChainAccess(addressBook_, admin) {
        if (rewardBps_ > BPS_DENOMINATOR) revert InvalidBps(rewardBps_);
        _rewardBps = rewardBps_;
        emit RewardBpsUpdated(0, rewardBps_);
    }

    /// @inheritdoc IReferralProgram
    function refer(address referrer) external {
        if (referrer == address(0)) revert ZeroAddress();
        if (referrer == msg.sender) revert SelfReferral(msg.sender);
        if (_referrerOf[msg.sender] != address(0)) revert AlreadyReferred(msg.sender);

        _referrerOf[msg.sender] = referrer;
        emit Referred(referrer, msg.sender);
    }

    /// @inheritdoc IReferralProgram
    /// @dev Idempotently safe against unattributed referees: if the referee has no referrer, the
    ///      conversion is recorded with a zero reward rather than reverting, so callers integrating
    ///      the hook never need to branch on attribution.
    function recordConversion(address referee, uint256 value)
        external
        onlyRole(CONVERSION_RECORDER_ROLE)
    {
        if (referee == address(0)) revert ZeroAddress();
        if (value == 0) revert ZeroAmount();

        address referrer = _referrerOf[referee];
        uint256 reward = 0;
        if (referrer != address(0)) {
            reward = (value * _rewardBps) / BPS_DENOMINATOR;
            if (reward != 0) {
                _pending[referrer] += reward;
            }
        }
        emit ConversionRecorded(referee, value, reward);
    }

    /// @inheritdoc IReferralProgram
    function claimReferral() external nonReentrant {
        _requireNotGloballyPaused();

        uint256 amount = _pending[msg.sender];
        if (amount == 0) revert NothingToClaim(msg.sender);

        _pending[msg.sender] = 0;
        IERC20(_addr(Keys.GOVERNANCE_TOKEN)).safeTransfer(msg.sender, amount);
        emit ReferralClaimed(msg.sender, amount);
    }

    /// @notice Update the referral reward rate. DEFAULT_ADMIN_ROLE only.
    function setRewardBps(uint256 rewardBps_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (rewardBps_ > BPS_DENOMINATOR) revert InvalidBps(rewardBps_);
        uint256 old = _rewardBps;
        _rewardBps = rewardBps_;
        emit RewardBpsUpdated(old, rewardBps_);
    }

    /// @inheritdoc IReferralProgram
    function referrerOf(address referee) external view returns (address) {
        return _referrerOf[referee];
    }

    /// @inheritdoc IReferralProgram
    function pendingReward(address referrer) external view returns (uint256) {
        return _pending[referrer];
    }

    /// @notice Current referral reward rate in basis points.
    function rewardBps() external view returns (uint256) {
        return _rewardBps;
    }
}
