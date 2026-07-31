// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IReceivableRegistry } from "../interfaces/IReceivableRegistry.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title ReceivableRegistry
/// @notice Records the commercial terms of each on-chain receivable (face value, due date,
///         obligor, settlement token) keyed by its batch id.
/// @dev Implements the {IReceivableRegistry} surface. It is NOT declared `is IReceivableRegistry`
///      because that interface redeclares `ZeroAddress`, which already lives on {ProofChainAccess}
///      (Solidity forbids the duplicate). The {IReceivableRegistry.Terms} struct is reused so the
///      external ABI matches exactly. Terms are immutable once written — a receivable's economics
///      must not change under lenders that have already priced it.
contract ReceivableRegistry is ProofChainAccess {
    mapping(bytes32 => IReceivableRegistry.Terms) private _terms;

    event ReceivableRegistered(
        bytes32 indexed batchId, uint256 faceValue, uint64 dueDate, address indexed obligor, address token
    );

    error ReceivableExists(bytes32 batchId);
    error UnknownReceivable(bytes32 batchId);
    error ZeroAmount();
    error InvalidDueDate();
    error NotBatchOwner(bytes32 batchId);
    error UnknownBatch(bytes32 batchId);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @notice Register the terms of a receivable. Callable by the batch's registered supplier or
    ///         by an admin. `obligor` is the buyer/debtor expected to pay; `token` the currency.
    function register(bytes32 batchId, uint256 faceValue, uint64 dueDate, address obligor, address token)
        external
    {
        if (faceValue == 0) revert ZeroAmount();
        if (obligor == address(0) || token == address(0)) revert ZeroAddress();
        if (dueDate <= block.timestamp) revert InvalidDueDate();
        if (_terms[batchId].exists) revert ReceivableExists(batchId);

        IProvenanceRegistry prov = IProvenanceRegistry(_addr(Keys.PROVENANCE_REGISTRY));
        if (!prov.batchExists(batchId)) revert UnknownBatch(batchId);

        // Only the batch's supplier (or an admin) may declare its receivable terms.
        if (prov.batchSupplier(batchId) != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotBatchOwner(batchId);
        }

        _terms[batchId] = IReceivableRegistry.Terms({
            batchId: batchId,
            faceValue: faceValue,
            dueDate: dueDate,
            obligor: obligor,
            token: token,
            exists: true
        });

        emit ReceivableRegistered(batchId, faceValue, dueDate, obligor, token);
    }

    /// @notice The stored terms for a receivable; reverts {UnknownReceivable} if none.
    function termsOf(bytes32 batchId) external view returns (IReceivableRegistry.Terms memory) {
        IReceivableRegistry.Terms memory t = _terms[batchId];
        if (!t.exists) revert UnknownReceivable(batchId);
        return t;
    }

    /// @notice Whether terms exist for a receivable.
    function exists(bytes32 batchId) external view returns (bool) {
        return _terms[batchId].exists;
    }
}
