// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/// @notice Minimal mintable ERC1155 used to exercise the {OrderBook} asset leg in tests.
contract MockERC1155 is ERC1155 {
    constructor() ERC1155("ipfs://mock/{id}") { }

    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount, "");
    }
}
