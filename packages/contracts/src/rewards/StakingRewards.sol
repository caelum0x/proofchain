// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IStakingRewards } from "../interfaces/IStakingRewards.sol";
import { IEmissionsController } from "../interfaces/IEmissionsController.sol";
import { IGovernanceToken } from "../interfaces/IGovernanceToken.sol";

/// @title StakingRewards
/// @notice Stake PROOF/LP tokens to earn PROOF emissions, using the classic Synthetix
///         reward-per-token accounting so rewards accrue in O(1) regardless of staker count.
/// @dev The emission rate (reward tokens per second) is owned by the {EmissionsController} and
///      resolved via the AddressBook. To keep the reward integral correct across rate changes, the
///      contract caches the rate locally and re-reads it through {syncRewardRate}, which settles
///      all accrual at the old rate before adopting the new one. Rewards are paid by minting the
///      PROOF {GovernanceToken} (this contract must hold its `MINTER_ROLE`). All fund movement is
///      `nonReentrant` + `SafeERC20`, with staked amounts measured from balance deltas so
///      fee-on-transfer staking tokens can never over-credit an account.
contract StakingRewards is ProofChainAccess, ReentrancyGuard, IStakingRewards {
    using SafeERC20 for IERC20;

    /// @notice Fixed-point scale for reward-per-token accumulation.
    uint256 private constant PRECISION = 1e18;

    /// @notice The token users stake (PROOF, an LP token, ...). Set once at deploy.
    IERC20 public immutable stakingToken;

    /// @notice Cached per-second emission rate, synced from the {EmissionsController}.
    uint256 public rewardRate;

    /// @notice Accumulated reward per staked token, scaled by {PRECISION}.
    uint256 public rewardPerTokenStored;

    /// @notice Timestamp of the last accrual checkpoint.
    uint256 public lastUpdateTime;

    uint256 private _totalStaked;
    mapping(address => uint256) private _balances;
    mapping(address => uint256) private _userRewardPerTokenPaid;
    mapping(address => uint256) private _rewards;

    event RewardRateSynced(uint256 rate);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    /// @param stakingToken_ The ERC20 users stake to earn emissions.
    constructor(address addressBook_, address admin, address stakingToken_) ProofChainAccess(addressBook_, admin) {
        if (stakingToken_ == address(0)) revert ZeroAddress();
        stakingToken = IERC20(stakingToken_);
        lastUpdateTime = block.timestamp;
        rewardRate = IEmissionsController(_addr(Keys.EMISSIONS_CONTROLLER)).currentRate();
    }

    /// @dev Settles accrual up to `block.timestamp` at the current cached rate before mutating
    ///      stake, rate, or paying out. Pass `address(0)` for global-only updates.
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            _rewards[account] = earned(account);
            _userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /// @inheritdoc IStakingRewards
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        _requireNotGloballyPaused();

        uint256 balanceBefore = stakingToken.balanceOf(address(this));
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = stakingToken.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        _totalStaked += received;
        _balances[msg.sender] += received;
        emit Staked(msg.sender, received);
    }

    /// @inheritdoc IStakingRewards
    function withdraw(uint256 amount) external nonReentrant updateReward(msg.sender) {
        _withdraw(amount);
    }

    /// @inheritdoc IStakingRewards
    function getReward() external nonReentrant updateReward(msg.sender) {
        _getReward();
    }

    /// @inheritdoc IStakingRewards
    function exit() external nonReentrant updateReward(msg.sender) {
        _withdraw(_balances[msg.sender]);
        _getReward();
    }

    /// @notice Settle accrual then re-read the emission rate from the {EmissionsController}.
    /// @dev Callable by anyone (permissionless keeper): it can only bring the contract in line with
    ///      the governance-set rate, never divert funds. Must run whenever governance retunes
    ///      emissions so the reward integral uses the correct rate over each interval.
    function syncRewardRate() external nonReentrant updateReward(address(0)) {
        uint256 rate = IEmissionsController(_addr(Keys.EMISSIONS_CONTROLLER)).currentRate();
        rewardRate = rate;
        emit RewardRateSynced(rate);
    }

    /// @inheritdoc IStakingRewards
    function earned(address account) public view returns (uint256) {
        uint256 delta = rewardPerToken() - _userRewardPerTokenPaid[account];
        return (_balances[account] * delta) / PRECISION + _rewards[account];
    }

    /// @notice Current accumulated reward per staked token, scaled by {PRECISION}.
    function rewardPerToken() public view returns (uint256) {
        if (_totalStaked == 0) {
            return rewardPerTokenStored;
        }
        uint256 elapsed = block.timestamp - lastUpdateTime;
        return rewardPerTokenStored + (elapsed * rewardRate * PRECISION) / _totalStaked;
    }

    /// @inheritdoc IStakingRewards
    function stakedOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    /// @notice Total tokens staked across all accounts.
    function totalStaked() external view returns (uint256) {
        return _totalStaked;
    }

    // --- internal money movement (shared by public entrypoints and {exit}) ---

    function _withdraw(uint256 amount) private {
        if (amount == 0) revert ZeroAmount();
        uint256 staked = _balances[msg.sender];
        if (amount > staked) revert InsufficientStaked(msg.sender, amount, staked);

        _totalStaked -= amount;
        _balances[msg.sender] = staked - amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function _getReward() private {
        uint256 reward = _rewards[msg.sender];
        if (reward != 0) {
            _rewards[msg.sender] = 0;
            IGovernanceToken(_addr(Keys.GOVERNANCE_TOKEN)).mint(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }
}
