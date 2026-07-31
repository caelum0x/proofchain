// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IOracleAggregator } from "../interfaces/IOracleAggregator.sol";

/// @title OracleAggregator
/// @notice Aggregates independent oracle submissions into a single robust value per feed. A feed is
///         configured with an allowlist of reporters and a minimum quorum; reporters each submit one
///         value per round, and once quorum is met the round is finalized to the MEDIAN of submissions —
///         resistant to a minority of faulty/malicious reporters — before the next round opens.
/// @dev Consumers (PriceOracle mirrors, checkpoint feeds, energy meters) read the last finalized answer
///      through {IOracleAggregator} resolved via the {AddressBook}. Reporter allowlists are managed by
///      keepers / pool managers; end reporters can only {submit}.
contract OracleAggregator is ProofChainAccess, IOracleAggregator {
    /// @dev feedId => feed configuration (quorum, reporter count, current round pointer, active flag).
    mapping(bytes32 => FeedConfig) private _feeds;

    /// @dev feedId => reporter => allowlisted flag.
    mapping(bytes32 => mapping(address => bool)) private _reporters;

    /// @dev feedId => roundId => round record.
    mapping(bytes32 => mapping(uint64 => Round)) private _rounds;

    /// @dev feedId => roundId => submitted values (used to compute the median at finalization).
    mapping(bytes32 => mapping(uint64 => uint256[])) private _submissions;

    /// @dev feedId => roundId => reporter => already-submitted flag (one submission per reporter/round).
    mapping(bytes32 => mapping(uint64 => mapping(address => bool))) private _hasSubmitted;

    /// @dev feedId => last finalized roundId (0 when no round has finalized yet).
    mapping(bytes32 => uint64) private _lastFinalized;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IOracleAggregator
    function configureFeed(bytes32 feedId, uint8 minQuorum) external override onlyConfigurer {
        _requireNotGloballyPaused();
        if (minQuorum == 0) revert InvalidQuorum(minQuorum);
        if (_feeds[feedId].feedId != bytes32(0)) revert FeedExists(feedId);

        _feeds[feedId] = FeedConfig({
            feedId: feedId,
            minQuorum: minQuorum,
            reporterCount: 0,
            roundId: 1,
            active: true
        });
        // Open the first collecting round.
        _rounds[feedId][1] = Round({
            roundId: 1,
            answer: 0,
            submissionCount: 0,
            finalizedAt: 0,
            state: RoundState.Collecting
        });

        emit FeedConfigured(feedId, minQuorum);
    }

    /// @inheritdoc IOracleAggregator
    function addReporter(bytes32 feedId, address reporter) external override onlyConfigurer {
        _requireNotGloballyPaused();
        FeedConfig storage f = _requireFeed(feedId);
        if (reporter == address(0)) revert ZeroAddress();
        if (_reporters[feedId][reporter]) revert ReporterExists(feedId, reporter);

        _reporters[feedId][reporter] = true;
        f.reporterCount += 1;
        emit ReporterAdded(feedId, reporter);
    }

    /// @inheritdoc IOracleAggregator
    function removeReporter(bytes32 feedId, address reporter) external override onlyConfigurer {
        _requireNotGloballyPaused();
        FeedConfig storage f = _requireFeed(feedId);
        if (!_reporters[feedId][reporter]) revert NotReporter(feedId, reporter);

        _reporters[feedId][reporter] = false;
        f.reporterCount -= 1;
        emit ReporterRemoved(feedId, reporter);
    }

    /// @inheritdoc IOracleAggregator
    function submit(bytes32 feedId, uint256 value) external override {
        _requireNotGloballyPaused();
        FeedConfig storage f = _requireFeed(feedId);
        if (!f.active) revert FeedInactive(feedId);
        if (!_reporters[feedId][msg.sender]) revert NotReporter(feedId, msg.sender);

        uint64 roundId = f.roundId;
        if (_hasSubmitted[feedId][roundId][msg.sender]) revert AlreadySubmitted(feedId, roundId, msg.sender);

        _hasSubmitted[feedId][roundId][msg.sender] = true;
        _submissions[feedId][roundId].push(value);

        Round storage r = _rounds[feedId][roundId];
        r.submissionCount += 1;
        if (r.state == RoundState.None) r.state = RoundState.Collecting;

        emit Submitted(feedId, roundId, msg.sender, value);
    }

    /// @inheritdoc IOracleAggregator
    function finalizeRound(bytes32 feedId) external override returns (uint256 answer) {
        _requireNotGloballyPaused();
        FeedConfig storage f = _requireFeed(feedId);
        if (!f.active) revert FeedInactive(feedId);

        uint64 roundId = f.roundId;
        Round storage r = _rounds[feedId][roundId];
        if (r.submissionCount < f.minQuorum) {
            revert QuorumNotMet(feedId, r.submissionCount, f.minQuorum);
        }

        answer = _median(_submissions[feedId][roundId]);
        r.answer = answer;
        r.finalizedAt = uint64(block.timestamp);
        r.state = RoundState.Finalized;
        _lastFinalized[feedId] = roundId;

        // Open the next collecting round.
        uint64 nextRound = roundId + 1;
        f.roundId = nextRound;
        _rounds[feedId][nextRound] = Round({
            roundId: nextRound,
            answer: 0,
            submissionCount: 0,
            finalizedAt: 0,
            state: RoundState.Collecting
        });

        emit RoundFinalized(feedId, roundId, answer, r.submissionCount);
    }

    /// @inheritdoc IOracleAggregator
    function latestAnswer(bytes32 feedId) external view override returns (uint256 answer, uint64 roundId) {
        roundId = _lastFinalized[feedId];
        if (roundId == 0) revert NoFinalizedRound(feedId);
        answer = _rounds[feedId][roundId].answer;
    }

    /// @inheritdoc IOracleAggregator
    function feedConfigOf(bytes32 feedId) external view override returns (FeedConfig memory) {
        return _feeds[feedId];
    }

    /// @inheritdoc IOracleAggregator
    function roundOf(bytes32 feedId, uint64 roundId) external view override returns (Round memory) {
        return _rounds[feedId][roundId];
    }

    /// @notice True if `reporter` is currently allowlisted for `feedId`.
    function isReporter(bytes32 feedId, address reporter) external view returns (bool) {
        return _reporters[feedId][reporter];
    }

    /// @dev Load a configured feed or revert.
    function _requireFeed(bytes32 feedId) private view returns (FeedConfig storage f) {
        f = _feeds[feedId];
        if (f.feedId == bytes32(0)) revert UnknownFeed(feedId);
    }

    /// @dev Restrict feed administration to keepers or pool managers.
    modifier onlyConfigurer() {
        if (!hasRole(Roles.KEEPER_ROLE, msg.sender) && !hasRole(Roles.POOL_MANAGER_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, Roles.KEEPER_ROLE);
        }
        _;
    }

    /// @dev Median of a memory array of submissions. Copies then insertion-sorts (submission counts are
    ///      small — bounded by reporter count) and returns the middle element (the upper of the two
    ///      central values for an even count). Only ever called after quorum, so `n >= 1`.
    function _median(uint256[] storage values) private view returns (uint256) {
        uint256 n = values.length;
        uint256[] memory arr = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            arr[i] = values[i];
        }
        // Insertion sort — O(n^2) but n is bounded by the small reporter set.
        for (uint256 i = 1; i < n; ++i) {
            uint256 key = arr[i];
            uint256 j = i;
            while (j > 0 && arr[j - 1] > key) {
                arr[j] = arr[j - 1];
                unchecked {
                    --j;
                }
            }
            arr[j] = key;
        }
        return arr[n / 2];
    }
}
