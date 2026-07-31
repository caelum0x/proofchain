// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { IPaymentRouter } from "../interfaces/IPaymentRouter.sol";
import { IStablecoinRegistry } from "../interfaces/IStablecoinRegistry.sol";
import { IFeeManager } from "../interfaces/IFeeManager.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";

/// @title PaymentRouter
/// @notice Routes multi-stablecoin payments: pulls an accepted token from a payer, skims the
///         protocol fee into the Treasury via the {FeeManager}, and forwards the net to a
///         destination.
/// @dev Deps (AddressBook): StablecoinRegistry, FeeManager, Treasury (Treasury is used
///      transitively by FeeManager.collect). All fund movement is `nonReentrant` and uses
///      SafeERC20. `route` may only be driven by the payer themselves or a KEEPER_ROLE operator,
///      so a third party can never redirect a victim's standing allowance.
contract PaymentRouter is ProofChainAccess, ReentrancyGuard, IPaymentRouter {
    using SafeERC20 for IERC20;

    /// @notice Raised when a caller tries to route funds on behalf of a payer they do not control.
    error UnauthorizedRouter(address caller, address payer);

    /// @param addressBook_ Deployed AddressBook.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IPaymentRouter
    function pay(bytes32 action, address token, address destination, uint256 amount)
        external
        override
        returns (uint256 net)
    {
        return _route(action, token, msg.sender, destination, amount);
    }

    /// @inheritdoc IPaymentRouter
    function route(bytes32 action, address token, address payer, address destination, uint256 amount)
        external
        override
        returns (uint256 net)
    {
        if (msg.sender != payer && !hasRole(Roles.KEEPER_ROLE, msg.sender)) {
            revert UnauthorizedRouter(msg.sender, payer);
        }
        return _route(action, token, payer, destination, amount);
    }

    /// @dev Core routing logic shared by {pay} and {route}.
    function _route(bytes32 action, address token, address payer, address destination, uint256 amount)
        internal
        nonReentrant
        returns (uint256 net)
    {
        if (token == address(0) || payer == address(0) || destination == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) revert IPaymentRouter.ZeroAmount();

        IStablecoinRegistry registry = IStablecoinRegistry(_addr(Keys.STABLECOIN_REGISTRY));
        if (!registry.isAccepted(token)) revert TokenNotAccepted(token);

        IFeeManager feeManager = IFeeManager(_addr(Keys.FEE_MANAGER));

        // Pull the gross amount into the router, recording the ACTUAL received amount so
        // fee-on-transfer tokens can never leave the router paying out more than it holds.
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(payer, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        // Skim the protocol fee to the Treasury through the FeeManager. The FeeManager pulls
        // the fee from this router (which now custodies the funds); approval is scoped and reset.
        uint256 fee;
        uint256 feeQuote = feeManager.feeFor(action, received);
        if (feeQuote > 0) {
            IERC20(token).forceApprove(address(feeManager), feeQuote);
            fee = feeManager.collect(action, token, address(this), received);
            IERC20(token).forceApprove(address(feeManager), 0);
        }

        net = received - fee;
        if (net > 0) {
            IERC20(token).safeTransfer(destination, net);
        }

        emit Routed(action, token, payer, destination, net, fee);
        return net;
    }
}
