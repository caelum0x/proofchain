// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICreditLineManager
/// @notice Revolving credit lines for onboarded borrowers. An underwriter opens a line with a limit and
///         interest rate; the borrower draws and repays against it, with utilization and accrued interest
///         tracked. Lines can be adjusted, frozen, or closed.
/// @dev deps (AddressBook): StablecoinRegistry, KYCRegistry, ReputationEngine, Treasury.
interface ICreditLineManager {
    enum LineState {
        None,
        Active,
        Frozen,
        Closed
    }

    struct CreditLine {
        bytes32 lineId;
        address borrower;
        address token;
        uint256 limit;
        uint256 drawn;
        uint256 accruedInterest;
        uint16 aprBps;
        uint64 lastAccrual;
        LineState state;
    }

    event LineOpened(bytes32 indexed lineId, address indexed borrower, address token, uint256 limit, uint16 aprBps);
    event LimitChanged(bytes32 indexed lineId, uint256 oldLimit, uint256 newLimit);
    event RateChanged(bytes32 indexed lineId, uint16 oldAprBps, uint16 newAprBps);
    event Drawn(bytes32 indexed lineId, address indexed borrower, uint256 amount, uint256 newDrawn);
    event Repaid(bytes32 indexed lineId, uint256 principalPaid, uint256 interestPaid, uint256 newDrawn);
    event LineFrozen(bytes32 indexed lineId);
    event LineClosed(bytes32 indexed lineId);

    error LineExists(bytes32 lineId);
    error UnknownLine(bytes32 lineId);
    error InvalidState(bytes32 lineId, LineState expected, LineState actual);
    error NotBorrower(bytes32 lineId);
    error LimitExceeded(uint256 requested, uint256 available);
    error OutstandingBalance(bytes32 lineId, uint256 balance);
    error ZeroAmount();

    /// @notice Underwriter opens a revolving line for a borrower. UNDERWRITER_ROLE only.
    function openLine(bytes32 lineId, address borrower, address token, uint256 limit, uint16 aprBps) external;

    /// @notice Adjust the credit limit of an active line.
    function setLimit(bytes32 lineId, uint256 newLimit) external;

    /// @notice Adjust the interest rate; accrues at the old rate first.
    function setRate(bytes32 lineId, uint16 newAprBps) external;

    /// @notice Borrower draws funds up to the available headroom.
    function draw(bytes32 lineId, uint256 amount) external;

    /// @notice Borrower repays; applies to accrued interest first, then principal.
    function repay(bytes32 lineId, uint256 amount) external;

    /// @notice Freeze further draws on a line.
    function freeze(bytes32 lineId) external;

    /// @notice Close a fully-repaid line.
    function close(bytes32 lineId) external;

    /// @notice Current outstanding (drawn + accrued interest to now) for a line.
    function outstandingOf(bytes32 lineId) external view returns (uint256);

    function lineOf(bytes32 lineId) external view returns (CreditLine memory);
}
