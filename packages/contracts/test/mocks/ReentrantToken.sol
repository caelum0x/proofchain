// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SettlementEscrow } from "../../src/SettlementEscrow.sol";

/// @notice Malicious ERC20 that re-enters SettlementEscrow.settle on transfer.
/// @dev Used to prove the nonReentrant guard blocks reentrancy during settlement.
contract ReentrantToken is ERC20 {
    SettlementEscrow public escrow;
    bytes32 public targetBatch;
    bool public armed;

    constructor() ERC20("Reentrant", "RE") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(SettlementEscrow escrow_, bytes32 batchId) external {
        escrow = escrow_;
        targetBatch = batchId;
        armed = true;
    }

    /// @dev On transfer (invoked by escrow.settle -> safeTransfer), attempt to re-enter settle.
    function transfer(address to, uint256 value) public override returns (bool) {
        if (armed) {
            armed = false; // prevent infinite recursion if guard were absent
            escrow.settle(targetBatch);
        }
        return super.transfer(to, value);
    }
}
