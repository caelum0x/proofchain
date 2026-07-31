// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IEmissionsTrading
/// @notice Cap-and-trade emissions allowance system. A regulator opens a compliance period with a total cap,
///         allocates allowances (1 unit == 1 tCO2e) to installations, participants transfer allowances, and
///         each installation surrenders allowances to cover its verified reported emissions.
/// @dev deps (AddressBook): SustainabilityOracle, ESGRegistry, RenewableEnergyCertificate.
interface IEmissionsTrading {
    enum PeriodState {
        None,
        Open,
        Reconciling,
        Closed
    }

    struct Period {
        bytes32 periodId;
        uint256 cap;
        uint256 allocated;
        uint64 startsAt;
        uint64 endsAt;
        PeriodState state;
    }

    struct Account {
        uint256 balance;
        uint256 reportedEmissions;
        uint256 surrendered;
    }

    event PeriodOpened(bytes32 indexed periodId, uint256 cap, uint64 startsAt, uint64 endsAt);
    event Allocated(bytes32 indexed periodId, address indexed installation, uint256 amount);
    event Transferred(bytes32 indexed periodId, address indexed from, address indexed to, uint256 amount);
    event EmissionsReported(bytes32 indexed periodId, address indexed installation, uint256 tCO2e);
    event Surrendered(bytes32 indexed periodId, address indexed installation, uint256 amount);
    event PeriodClosed(bytes32 indexed periodId);

    error PeriodExists(bytes32 periodId);
    error UnknownPeriod(bytes32 periodId);
    error InvalidState(bytes32 periodId, PeriodState expected, PeriodState actual);
    error CapExceeded(bytes32 periodId, uint256 requested, uint256 remaining);
    error InsufficientAllowances(address account, uint256 requested, uint256 available);
    error ZeroAmount();
    error InvalidWindow(uint64 startsAt, uint64 endsAt);

    /// @notice Open a compliance period with a hard cap. GOVERNOR_ROLE / regulator.
    function openPeriod(bytes32 periodId, uint256 cap, uint64 startsAt, uint64 endsAt) external;

    /// @notice Allocate allowances to an installation within the cap. POOL_MANAGER_ROLE / regulator.
    function allocate(bytes32 periodId, address installation, uint256 amount) external;

    /// @notice Transfer allowances to another account within a period.
    function transfer(bytes32 periodId, address to, uint256 amount) external;

    /// @notice Record an installation's verified emissions. AGENT_ROLE / oracle.
    function reportEmissions(bytes32 periodId, address installation, uint256 tCO2e) external;

    /// @notice Surrender allowances to cover reported emissions. Installation only.
    function surrender(bytes32 periodId, uint256 amount) external;

    /// @notice Close a period once reconciliation is complete.
    function closePeriod(bytes32 periodId) external;

    /// @notice True if the installation has surrendered enough to cover reported emissions.
    function isCompliant(bytes32 periodId, address installation) external view returns (bool);

    function balanceOf(bytes32 periodId, address account) external view returns (uint256);
    function accountOf(bytes32 periodId, address account) external view returns (Account memory);
    function periodOf(bytes32 periodId) external view returns (Period memory);
}
