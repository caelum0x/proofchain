// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Trivial governed target: only its `owner` (the timelock) may change `value`.
///         Used to exercise the full propose -> vote -> queue -> execute governance round-trip.
contract Box {
    uint256 public value;
    address public owner;

    error NotOwner();

    event ValueChanged(uint256 newValue);

    constructor(address owner_) {
        owner = owner_;
    }

    function store(uint256 newValue) external {
        if (msg.sender != owner) revert NotOwner();
        value = newValue;
        emit ValueChanged(newValue);
    }
}
