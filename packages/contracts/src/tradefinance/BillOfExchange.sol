// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IBillOfExchange } from "../interfaces/IBillOfExchange.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";

/// @title BillOfExchange
/// @notice Negotiable draft. A drawer orders a drawee to pay a fixed sum to a payee at sight or at
///         maturity. The drawee accepts (committing to pay), the payee right can be endorsed to new
///         holders, and settlement pulls funds from the acceptor to the current payee.
/// @dev No funds are escrowed at draw; payment pulls from the accepting drawee via {SafeERC20} and
///      is `nonReentrant`. Endorsement requires prior acceptance so a payable, transferable claim
///      always corresponds to a committed acceptor. Peers resolved via {AddressBook}.
contract BillOfExchange is ProofChainAccess, ReentrancyGuard, IBillOfExchange {
    using SafeERC20 for IERC20;

    mapping(bytes32 => Bill) private _bills;

    /// @notice A settlement token outside the {StablecoinRegistry} allowlist was supplied.
    error TokenNotAccepted(address token);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IBillOfExchange
    function draw(
        bytes32 billId,
        address drawee,
        address payee,
        address token,
        uint256 amount,
        uint64 maturity,
        bool sight
    ) external {
        _requireNotGloballyPaused();
        if (_bills[billId].state != BillState.None) revert BillExists(billId);
        if (amount == 0) revert ZeroAmount();
        if (drawee == address(0) || payee == address(0) || token == address(0)) revert ZeroAddress();
        _requireAccepted(token);

        _bills[billId] = Bill({
            billId: billId,
            drawer: msg.sender,
            drawee: drawee,
            payee: payee,
            token: token,
            amount: amount,
            maturity: maturity,
            sight: sight,
            state: BillState.Drawn
        });

        emit Drawn(billId, msg.sender, drawee, payee, token, amount, maturity);
    }

    /// @inheritdoc IBillOfExchange
    function accept(bytes32 billId) external {
        Bill storage b = _bills[billId];
        _requireExists(b, billId);
        if (b.state != BillState.Drawn) revert InvalidState(billId, BillState.Drawn, b.state);
        if (msg.sender != b.drawee) revert NotDrawee(billId);

        b.state = BillState.Accepted;
        emit Accepted(billId, msg.sender);
    }

    /// @inheritdoc IBillOfExchange
    function endorse(bytes32 billId, address to) external {
        Bill storage b = _bills[billId];
        _requireExists(b, billId);
        if (b.state != BillState.Accepted && b.state != BillState.Endorsed) {
            revert InvalidState(billId, BillState.Accepted, b.state);
        }
        if (msg.sender != b.payee) revert NotPayee(billId);
        if (to == address(0)) revert ZeroAddress();

        address from = b.payee;
        b.payee = to;
        b.state = BillState.Endorsed;
        emit Endorsed(billId, from, to);
    }

    /// @inheritdoc IBillOfExchange
    function pay(bytes32 billId) external nonReentrant {
        Bill storage b = _bills[billId];
        _requireExists(b, billId);
        if (b.state != BillState.Accepted && b.state != BillState.Endorsed) {
            revert InvalidState(billId, BillState.Accepted, b.state);
        }
        // Term bills are only payable at/after maturity; sight bills are payable on demand.
        if (!b.sight && block.timestamp < b.maturity) revert NotMatured(billId, b.maturity);

        uint256 amount = b.amount;
        address payee = b.payee;
        address drawee = b.drawee;
        b.state = BillState.Paid;

        // Pull the sum from the accepting drawee to the current holder.
        IERC20(b.token).safeTransferFrom(drawee, payee, amount);
        emit Paid(billId, payee, amount);
    }

    /// @inheritdoc IBillOfExchange
    function dishonour(bytes32 billId, string calldata reason) external {
        Bill storage b = _bills[billId];
        _requireExists(b, billId);
        if (b.state != BillState.Accepted && b.state != BillState.Endorsed) {
            revert InvalidState(billId, BillState.Accepted, b.state);
        }
        if (msg.sender != b.payee) revert NotPayee(billId);
        if (!b.sight && block.timestamp < b.maturity) revert NotMatured(billId, b.maturity);

        b.state = BillState.Dishonoured;
        emit Dishonoured(billId, reason);
    }

    /// @inheritdoc IBillOfExchange
    function cancel(bytes32 billId) external {
        Bill storage b = _bills[billId];
        _requireExists(b, billId);
        if (b.state != BillState.Drawn) revert InvalidState(billId, BillState.Drawn, b.state);
        if (msg.sender != b.drawer) revert NotDrawer(billId);

        b.state = BillState.Cancelled;
        emit Cancelled(billId);
    }

    /// @inheritdoc IBillOfExchange
    function billOf(bytes32 billId) external view returns (Bill memory) {
        return _bills[billId];
    }

    function _requireExists(Bill storage b, bytes32 billId) private view {
        if (b.state == BillState.None) revert UnknownBill(billId);
    }

    /// @dev Enforce the {StablecoinRegistry} allowlist when wired; degrade gracefully otherwise.
    function _requireAccepted(address token) private view {
        address registry = _addrOrZero(Keys.STABLECOIN_REGISTRY);
        if (registry != address(0) && !IStablecoinRegistry(registry).isAccepted(token)) {
            revert TokenNotAccepted(token);
        }
    }
}
