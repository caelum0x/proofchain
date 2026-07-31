// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Malicious ERC20 that re-enters a target contract on the outbound `transfer` leg (refund /
///         payout) to prove the marketplace modules' `nonReentrant` guards hold.
contract ReenterERC20 is ERC20 {
    address public target;
    bytes public payload;
    bool public armed;

    constructor() ERC20("Reenter", "REEN") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @param target_ Contract to re-enter.
    /// @param payload_ ABI-encoded call to replay during the transfer.
    function arm(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
        armed = true;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (armed) {
            armed = false; // one-shot to avoid unbounded recursion if the guard were absent
            (bool ok, bytes memory ret) = target.call(payload);
            if (!ok) {
                assembly {
                    revert(add(ret, 0x20), mload(ret))
                }
            }
        }
        return super.transfer(to, value);
    }
}
