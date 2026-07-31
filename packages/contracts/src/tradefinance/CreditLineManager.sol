// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ICreditLineManager } from "../interfaces/ICreditLineManager.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";
import { IKYCRegistry } from "../interfaces/IKYCRegistry.sol";

/// @title CreditLineManager
/// @notice Revolving credit lines for onboarded borrowers. An underwriter opens a line with a limit
///         and APR; the borrower draws against available headroom and repays (interest first, then
///         principal). Interest accrues linearly on the drawn balance. The contract custodies its own
///         lending liquidity, disbursing draws from and receiving repayments into its token balance.
/// @dev Fund movement via {SafeERC20} and `nonReentrant`. Optional {KYCRegistry} gate on line
///      opening. Peers resolved via {AddressBook}; UNDERWRITER_ROLE administers lines.
contract CreditLineManager is ProofChainAccess, ReentrancyGuard, ICreditLineManager {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;
    uint256 private constant YEAR = 365 days;

    mapping(bytes32 => CreditLine) private _lines;

    /// @notice A settlement token outside the {StablecoinRegistry} allowlist was supplied.
    error TokenNotAccepted(address token);
    /// @notice The borrower has not passed KYC.
    error BorrowerNotVerified(address borrower);
    /// @notice The contract lacks liquidity to fund the requested draw.
    error InsufficientLiquidity(uint256 requested, uint256 available);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial UNDERWRITER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.UNDERWRITER_ROLE, admin);
    }

    /// @inheritdoc ICreditLineManager
    function openLine(bytes32 lineId, address borrower, address token, uint256 limit, uint16 aprBps)
        external
        onlyRole(Roles.UNDERWRITER_ROLE)
    {
        _requireNotGloballyPaused();
        if (_lines[lineId].state != LineState.None) revert LineExists(lineId);
        if (borrower == address(0) || token == address(0)) revert ZeroAddress();
        if (limit == 0) revert ZeroAmount();
        _requireAccepted(token);
        _requireKyc(borrower);

        _lines[lineId] = CreditLine({
            lineId: lineId,
            borrower: borrower,
            token: token,
            limit: limit,
            drawn: 0,
            accruedInterest: 0,
            aprBps: aprBps,
            lastAccrual: uint64(block.timestamp),
            state: LineState.Active
        });

        emit LineOpened(lineId, borrower, token, limit, aprBps);
    }

    /// @inheritdoc ICreditLineManager
    function setLimit(bytes32 lineId, uint256 newLimit) external onlyRole(Roles.UNDERWRITER_ROLE) {
        CreditLine storage l = _lines[lineId];
        _requireActive(l, lineId);
        _accrue(l);
        uint256 old = l.limit;
        l.limit = newLimit;
        emit LimitChanged(lineId, old, newLimit);
    }

    /// @inheritdoc ICreditLineManager
    function setRate(bytes32 lineId, uint16 newAprBps) external onlyRole(Roles.UNDERWRITER_ROLE) {
        CreditLine storage l = _lines[lineId];
        _requireActive(l, lineId);
        _accrue(l); // settle interest at the old rate before switching
        uint16 old = l.aprBps;
        l.aprBps = newAprBps;
        emit RateChanged(lineId, old, newAprBps);
    }

    /// @inheritdoc ICreditLineManager
    function draw(bytes32 lineId, uint256 amount) external nonReentrant {
        CreditLine storage l = _lines[lineId];
        _requireActive(l, lineId);
        if (msg.sender != l.borrower) revert NotBorrower(lineId);
        if (amount == 0) revert ZeroAmount();

        _accrue(l);
        uint256 available = l.limit - l.drawn;
        if (amount > available) revert LimitExceeded(amount, available);

        IERC20 token = IERC20(l.token);
        uint256 liquidity = token.balanceOf(address(this));
        if (amount > liquidity) revert InsufficientLiquidity(amount, liquidity);

        l.drawn += amount;
        token.safeTransfer(l.borrower, amount);
        emit Drawn(lineId, l.borrower, amount, l.drawn);
    }

    /// @inheritdoc ICreditLineManager
    function repay(bytes32 lineId, uint256 amount) external nonReentrant {
        CreditLine storage l = _lines[lineId];
        if (l.state == LineState.None) revert UnknownLine(lineId);
        if (amount == 0) revert ZeroAmount();

        _accrue(l);

        // Apply the payment to accrued interest first, then to principal; ignore any excess.
        uint256 interestPaid = amount > l.accruedInterest ? l.accruedInterest : amount;
        uint256 principalPaid = amount - interestPaid;
        if (principalPaid > l.drawn) principalPaid = l.drawn;

        uint256 pulled = interestPaid + principalPaid;
        l.accruedInterest -= interestPaid;
        l.drawn -= principalPaid;

        // Interest and returned principal both flow into the contract's lending liquidity.
        if (pulled > 0) IERC20(l.token).safeTransferFrom(msg.sender, address(this), pulled);
        emit Repaid(lineId, principalPaid, interestPaid, l.drawn);
    }

    /// @inheritdoc ICreditLineManager
    function freeze(bytes32 lineId) external onlyRole(Roles.UNDERWRITER_ROLE) {
        CreditLine storage l = _lines[lineId];
        _requireActive(l, lineId);
        _accrue(l);
        l.state = LineState.Frozen;
        emit LineFrozen(lineId);
    }

    /// @inheritdoc ICreditLineManager
    function close(bytes32 lineId) external onlyRole(Roles.UNDERWRITER_ROLE) {
        CreditLine storage l = _lines[lineId];
        if (l.state != LineState.Active && l.state != LineState.Frozen) {
            revert InvalidState(lineId, LineState.Active, l.state);
        }
        _accrue(l);
        uint256 outstanding = l.drawn + l.accruedInterest;
        if (outstanding != 0) revert OutstandingBalance(lineId, outstanding);

        l.state = LineState.Closed;
        emit LineClosed(lineId);
    }

    /// @inheritdoc ICreditLineManager
    function outstandingOf(bytes32 lineId) external view returns (uint256) {
        CreditLine memory l = _lines[lineId];
        return l.drawn + l.accruedInterest + _pendingInterest(l);
    }

    /// @inheritdoc ICreditLineManager
    function lineOf(bytes32 lineId) external view returns (CreditLine memory) {
        return _lines[lineId];
    }

    /// @dev Capitalise interest accrued on the drawn balance since the last touch.
    function _accrue(CreditLine storage l) private {
        uint256 pending = _pendingInterest(l);
        if (pending > 0) l.accruedInterest += pending;
        l.lastAccrual = uint64(block.timestamp);
    }

    /// @dev Simple linear interest: drawn * apr * elapsed / (BPS * YEAR).
    function _pendingInterest(CreditLine memory l) private view returns (uint256) {
        if (l.drawn == 0 || l.aprBps == 0) return 0;
        uint256 elapsed = block.timestamp - l.lastAccrual;
        if (elapsed == 0) return 0;
        return (l.drawn * l.aprBps * elapsed) / (BPS * YEAR);
    }

    function _requireActive(CreditLine storage l, bytes32 lineId) private view {
        if (l.state == LineState.None) revert UnknownLine(lineId);
        if (l.state != LineState.Active) revert InvalidState(lineId, LineState.Active, l.state);
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }

    /// @dev Enforce the {KYCRegistry} gate when wired; degrade gracefully otherwise.
    function _requireKyc(address borrower) private view {
        address kyc = _addrOrZero(Keys.KYC_REGISTRY);
        if (kyc != address(0) && !IKYCRegistry(kyc).isVerified(borrower)) {
            revert BorrowerNotVerified(borrower);
        }
    }
}
