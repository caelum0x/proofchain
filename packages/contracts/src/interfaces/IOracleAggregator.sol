// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IOracleAggregator
/// @notice Aggregates independent oracle submissions into a single robust value per feed. A feed is configured
///         with an allowlist of reporters and a minimum quorum; reporters submit values each round, and once
///         quorum is met the aggregator finalizes the round to the median of submissions.
/// @dev deps (AddressBook): IoTSensorRegistry, PriceOracle, CheckpointOracle. Consumers read finalized rounds.
interface IOracleAggregator {
    enum RoundState {
        None,
        Collecting,
        Finalized
    }

    struct FeedConfig {
        bytes32 feedId;
        uint8 minQuorum;
        uint8 reporterCount;
        uint64 roundId;
        bool active;
    }

    struct Round {
        uint64 roundId;
        uint256 answer;
        uint8 submissionCount;
        uint64 finalizedAt;
        RoundState state;
    }

    event FeedConfigured(bytes32 indexed feedId, uint8 minQuorum);
    event ReporterAdded(bytes32 indexed feedId, address indexed reporter);
    event ReporterRemoved(bytes32 indexed feedId, address indexed reporter);
    event Submitted(bytes32 indexed feedId, uint64 indexed roundId, address indexed reporter, uint256 value);
    event RoundFinalized(bytes32 indexed feedId, uint64 indexed roundId, uint256 answer, uint8 submissionCount);

    error FeedExists(bytes32 feedId);
    error UnknownFeed(bytes32 feedId);
    error FeedInactive(bytes32 feedId);
    error NotReporter(bytes32 feedId, address reporter);
    error ReporterExists(bytes32 feedId, address reporter);
    error AlreadySubmitted(bytes32 feedId, uint64 roundId, address reporter);
    error QuorumNotMet(bytes32 feedId, uint8 have, uint8 need);
    error NoFinalizedRound(bytes32 feedId);
    error InvalidQuorum(uint8 minQuorum);

    /// @notice Configure a feed with a minimum quorum. KEEPER_ROLE / POOL_MANAGER_ROLE.
    function configureFeed(bytes32 feedId, uint8 minQuorum) external;

    /// @notice Add an allowlisted reporter to a feed.
    function addReporter(bytes32 feedId, address reporter) external;

    /// @notice Remove a reporter from a feed.
    function removeReporter(bytes32 feedId, address reporter) external;

    /// @notice Submit a value for the current round of a feed. Allowlisted reporter only.
    function submit(bytes32 feedId, uint256 value) external;

    /// @notice Finalize the current round to the median once quorum is met, opening the next round.
    function finalizeRound(bytes32 feedId) external returns (uint256 answer);

    /// @notice Latest finalized answer and round id; reverts if none finalized.
    function latestAnswer(bytes32 feedId) external view returns (uint256 answer, uint64 roundId);

    function feedConfigOf(bytes32 feedId) external view returns (FeedConfig memory);
    function roundOf(bytes32 feedId, uint64 roundId) external view returns (Round memory);
}
