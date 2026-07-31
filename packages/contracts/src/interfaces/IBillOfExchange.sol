// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IBillOfExchange
/// @notice Negotiable bill of exchange (draft): a drawer orders a drawee to pay a fixed sum to the
///         payee at sight or on a maturity date. Supports acceptance by the drawee, endorsement
///         (transfer of the payee right), and settlement pulling funds from the acceptor.
/// @dev deps (AddressBook): StablecoinRegistry, SettlementEscrow.
interface IBillOfExchange {
    enum BillState {
        None,
        Drawn,
        Accepted,
        Endorsed,
        Paid,
        Dishonoured,
        Cancelled
    }

    struct Bill {
        bytes32 billId;
        address drawer;
        address drawee;
        address payee;
        address token;
        uint256 amount;
        uint64 maturity;
        bool sight;
        BillState state;
    }

    event Drawn(
        bytes32 indexed billId,
        address indexed drawer,
        address indexed drawee,
        address payee,
        address token,
        uint256 amount,
        uint64 maturity
    );
    event Accepted(bytes32 indexed billId, address indexed drawee);
    event Endorsed(bytes32 indexed billId, address indexed from, address indexed to);
    event Paid(bytes32 indexed billId, address indexed payee, uint256 amount);
    event Dishonoured(bytes32 indexed billId, string reason);
    event Cancelled(bytes32 indexed billId);

    error BillExists(bytes32 billId);
    error UnknownBill(bytes32 billId);
    error InvalidState(bytes32 billId, BillState expected, BillState actual);
    error NotDrawee(bytes32 billId);
    error NotPayee(bytes32 billId);
    error NotDrawer(bytes32 billId);
    error ZeroAmount();
    error NotMatured(bytes32 billId, uint64 maturity);

    /// @notice Drawer creates a bill ordering `drawee` to pay `payee`.
    function draw(
        bytes32 billId,
        address drawee,
        address payee,
        address token,
        uint256 amount,
        uint64 maturity,
        bool sight
    ) external;

    /// @notice Drawee accepts the bill, committing to pay at maturity.
    function accept(bytes32 billId) external;

    /// @notice Current payee endorses the bill to a new holder.
    function endorse(bytes32 billId, address to) external;

    /// @notice Pay a matured/accepted bill, pulling funds from the acceptor to the payee.
    function pay(bytes32 billId) external;

    /// @notice Mark an unpaid, matured bill as dishonoured.
    function dishonour(bytes32 billId, string calldata reason) external;

    /// @notice Drawer cancels a bill before acceptance.
    function cancel(bytes32 billId) external;

    function billOf(bytes32 billId) external view returns (Bill memory);
}
