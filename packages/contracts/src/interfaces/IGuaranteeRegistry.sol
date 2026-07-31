// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IGuaranteeRegistry
/// @notice Bank guarantees / standby letters of credit. A guarantor issues an undertaking to pay a
///         beneficiary up to a cap if the principal (obligor) defaults, backed by escrowed collateral.
///         The beneficiary may call the guarantee on default; the guarantor releases it at expiry.
/// @dev deps (AddressBook): StablecoinRegistry, SettlementEscrow, Treasury.
interface IGuaranteeRegistry {
    enum GuaranteeType {
        Performance,
        Payment,
        BidBond,
        AdvancePayment,
        Standby
    }

    enum GuaranteeState {
        None,
        Issued,
        Called,
        PaidOut,
        Released,
        Expired
    }

    struct Guarantee {
        bytes32 guaranteeId;
        GuaranteeType gType;
        address guarantor;
        address principal;
        address beneficiary;
        address token;
        uint256 amount;
        uint64 expiry;
        bytes32 termsHash;
        GuaranteeState state;
    }

    event Issued(
        bytes32 indexed guaranteeId,
        GuaranteeType gType,
        address indexed guarantor,
        address indexed beneficiary,
        address principal,
        address token,
        uint256 amount,
        uint64 expiry
    );
    event Called(bytes32 indexed guaranteeId, address indexed beneficiary, string reason);
    event PaidOut(bytes32 indexed guaranteeId, address indexed beneficiary, uint256 amount);
    event Released(bytes32 indexed guaranteeId);
    event Expired(bytes32 indexed guaranteeId);

    error GuaranteeExists(bytes32 guaranteeId);
    error UnknownGuarantee(bytes32 guaranteeId);
    error InvalidState(bytes32 guaranteeId, GuaranteeState expected, GuaranteeState actual);
    error NotGuarantor(bytes32 guaranteeId);
    error NotBeneficiary(bytes32 guaranteeId);
    error ZeroAmount();
    error PastExpiry(uint64 expiry);
    error GuaranteeExpired(bytes32 guaranteeId);

    /// @notice Guarantor issues a guarantee, escrowing `amount` collateral. UNDERWRITER_ROLE only.
    function issue(
        bytes32 guaranteeId,
        GuaranteeType gType,
        address principal,
        address beneficiary,
        address token,
        uint256 amount,
        uint64 expiry,
        bytes32 termsHash
    ) external;

    /// @notice Beneficiary calls the guarantee upon principal default.
    function call(bytes32 guaranteeId, string calldata reason) external;

    /// @notice Guarantor honours a called guarantee, paying the beneficiary from collateral.
    function payOut(bytes32 guaranteeId) external;

    /// @notice Release an uncalled guarantee, returning collateral to the guarantor.
    function release(bytes32 guaranteeId) external;

    /// @notice Mark a guarantee expired after its expiry with no valid call.
    function expire(bytes32 guaranteeId) external;

    function guaranteeOf(bytes32 guaranteeId) external view returns (Guarantee memory);
}
