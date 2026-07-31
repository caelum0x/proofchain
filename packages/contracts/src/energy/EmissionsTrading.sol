// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IEmissionsTrading } from "../interfaces/IEmissionsTrading.sol";

/// @title EmissionsTrading
/// @notice Cap-and-trade emissions allowance ledger. A regulator opens a compliance period with a hard
///         cap, allocates allowances (1 unit == 1 tCO2e) to installations, participants transfer them,
///         verified emissions are reported, and installations surrender allowances to cover those
///         emissions. A period runs Open -> Reconciling -> Closed.
/// @dev A pure on-chain ledger (no ERC token): balances are scoped per `periodId` so allowances from
///      different compliance periods never fungibly mix — critical for vintage integrity. Allocation
///      is bounded by the period cap; transfers/surrenders are bounded by held balance. Peer
///      dependencies (SustainabilityOracle, ESGRegistry, RenewableEnergyCertificate) resolve lazily
///      through the {AddressBook}.
contract EmissionsTrading is ProofChainAccess, IEmissionsTrading {
    /// @dev periodId => period record.
    mapping(bytes32 => Period) private _periods;

    /// @dev periodId => account => allowance/emissions ledger.
    mapping(bytes32 => mapping(address => Account)) private _accounts;

    /// @notice Emitted when a period transitions from Open to Reconciling (true-up window opens).
    event PeriodReconciling(bytes32 indexed periodId);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE plus the initial GOVERNOR and POOL_MANAGER roles.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.GOVERNOR_ROLE, admin);
        _grantRole(Roles.POOL_MANAGER_ROLE, admin);
    }

    // --------------------------------------------------------------------- period lifecycle

    /// @inheritdoc IEmissionsTrading
    function openPeriod(bytes32 periodId, uint256 cap, uint64 startsAt, uint64 endsAt)
        external
        override
        onlyRole(Roles.GOVERNOR_ROLE)
    {
        _requireNotGloballyPaused();
        if (_periods[periodId].state != PeriodState.None) revert PeriodExists(periodId);
        if (cap == 0) revert ZeroAmount();
        if (endsAt <= startsAt) revert InvalidWindow(startsAt, endsAt);

        _periods[periodId] = Period({
            periodId: periodId,
            cap: cap,
            allocated: 0,
            startsAt: startsAt,
            endsAt: endsAt,
            state: PeriodState.Open
        });

        emit PeriodOpened(periodId, cap, startsAt, endsAt);
    }

    /// @notice Open the reconciliation (true-up) window: stops new allocation, keeps transfers,
    ///         emissions reporting and surrender open. GOVERNOR_ROLE / regulator.
    /// @dev Extends the interface lifecycle so the `Reconciling` state is a real, enforced phase.
    function beginReconciliation(bytes32 periodId) external onlyRole(Roles.GOVERNOR_ROLE) {
        _requireNotGloballyPaused();
        Period storage p = _periods[periodId];
        _requireState(periodId, p, PeriodState.Open);
        p.state = PeriodState.Reconciling;
        emit PeriodReconciling(periodId);
    }

    /// @inheritdoc IEmissionsTrading
    function closePeriod(bytes32 periodId) external override onlyRole(Roles.GOVERNOR_ROLE) {
        _requireNotGloballyPaused();
        Period storage p = _periods[periodId];
        if (p.state == PeriodState.None) revert UnknownPeriod(periodId);
        if (p.state == PeriodState.Closed) revert InvalidState(periodId, PeriodState.Reconciling, p.state);
        p.state = PeriodState.Closed;
        emit PeriodClosed(periodId);
    }

    // --------------------------------------------------------------------- allowances

    /// @inheritdoc IEmissionsTrading
    function allocate(bytes32 periodId, address installation, uint256 amount)
        external
        override
        onlyRole(Roles.POOL_MANAGER_ROLE)
    {
        _requireNotGloballyPaused();
        if (installation == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Period storage p = _periods[periodId];
        _requireState(periodId, p, PeriodState.Open);

        uint256 remaining = p.cap - p.allocated;
        if (amount > remaining) revert CapExceeded(periodId, amount, remaining);

        p.allocated += amount;
        _accounts[periodId][installation].balance += amount;

        emit Allocated(periodId, installation, amount);
    }

    /// @inheritdoc IEmissionsTrading
    function transfer(bytes32 periodId, address to, uint256 amount) external override {
        _requireNotGloballyPaused();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Period storage p = _periods[periodId];
        if (p.state != PeriodState.Open && p.state != PeriodState.Reconciling) {
            revert InvalidState(periodId, PeriodState.Open, p.state);
        }

        Account storage from = _accounts[periodId][msg.sender];
        if (from.balance < amount) revert InsufficientAllowances(msg.sender, amount, from.balance);

        from.balance -= amount;
        _accounts[periodId][to].balance += amount;

        emit Transferred(periodId, msg.sender, to, amount);
    }

    /// @inheritdoc IEmissionsTrading
    function reportEmissions(bytes32 periodId, address installation, uint256 tCO2e)
        external
        override
        onlyRole(Roles.AGENT_ROLE)
    {
        _requireNotGloballyPaused();
        if (installation == address(0)) revert ZeroAddress();

        Period storage p = _periods[periodId];
        if (p.state != PeriodState.Open && p.state != PeriodState.Reconciling) {
            revert InvalidState(periodId, PeriodState.Open, p.state);
        }

        _accounts[periodId][installation].reportedEmissions = tCO2e;
        emit EmissionsReported(periodId, installation, tCO2e);
    }

    /// @inheritdoc IEmissionsTrading
    function surrender(bytes32 periodId, uint256 amount) external override {
        _requireNotGloballyPaused();
        if (amount == 0) revert ZeroAmount();

        Period storage p = _periods[periodId];
        if (p.state != PeriodState.Open && p.state != PeriodState.Reconciling) {
            revert InvalidState(periodId, PeriodState.Open, p.state);
        }

        Account storage acct = _accounts[periodId][msg.sender];
        if (acct.balance < amount) revert InsufficientAllowances(msg.sender, amount, acct.balance);

        acct.balance -= amount;
        acct.surrendered += amount;

        emit Surrendered(periodId, msg.sender, amount);
    }

    // --------------------------------------------------------------------- views

    /// @inheritdoc IEmissionsTrading
    function isCompliant(bytes32 periodId, address installation) external view override returns (bool) {
        Account storage acct = _accounts[periodId][installation];
        return acct.surrendered >= acct.reportedEmissions;
    }

    /// @inheritdoc IEmissionsTrading
    function balanceOf(bytes32 periodId, address account) external view override returns (uint256) {
        return _accounts[periodId][account].balance;
    }

    /// @inheritdoc IEmissionsTrading
    function accountOf(bytes32 periodId, address account) external view override returns (Account memory) {
        return _accounts[periodId][account];
    }

    /// @inheritdoc IEmissionsTrading
    function periodOf(bytes32 periodId) external view override returns (Period memory) {
        if (_periods[periodId].state == PeriodState.None) revert UnknownPeriod(periodId);
        return _periods[periodId];
    }

    // --------------------------------------------------------------------- internal

    /// @dev Require a period to exist and be in `expected` state.
    function _requireState(bytes32 periodId, Period storage p, PeriodState expected) private view {
        if (p.state == PeriodState.None) revert UnknownPeriod(periodId);
        if (p.state != expected) revert InvalidState(periodId, expected, p.state);
    }
}
