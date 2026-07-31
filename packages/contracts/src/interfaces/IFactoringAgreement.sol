// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IFactoringAgreement
/// @notice A seller assigns an attested receivable to a factor, who advances a percentage of face value
///         up-front (advance rate) and collects the full amount from the debtor at maturity, netting a
///         factoring fee. Supports recourse and non-recourse modes.
/// @dev deps (AddressBook): AttestationRegistry, ReceivableRegistry, StablecoinRegistry, SettlementEscrow.
interface IFactoringAgreement {
    enum AgreementState {
        None,
        Offered,
        Funded,
        Collected,
        Defaulted,
        Cancelled
    }

    struct Agreement {
        bytes32 agreementId;
        bytes32 batchId;
        address seller;
        address factor;
        address debtor;
        address token;
        uint256 faceAmount;
        uint256 advanceAmount;
        uint16 feeBps;
        uint64 maturity;
        bool recourse;
        AgreementState state;
    }

    event Offered(
        bytes32 indexed agreementId,
        bytes32 indexed batchId,
        address indexed seller,
        address token,
        uint256 faceAmount,
        uint16 advanceRateBps,
        uint16 feeBps
    );
    event Funded(bytes32 indexed agreementId, address indexed factor, uint256 advanceAmount);
    event Collected(bytes32 indexed agreementId, uint256 collected, uint256 fee, uint256 rebateToSeller);
    event Defaulted(bytes32 indexed agreementId, uint256 recourseCharged);
    event Cancelled(bytes32 indexed agreementId);

    error AgreementExists(bytes32 agreementId);
    error UnknownAgreement(bytes32 agreementId);
    error InvalidState(bytes32 agreementId, AgreementState expected, AgreementState actual);
    error NotSeller(bytes32 agreementId);
    error NotFactor(bytes32 agreementId);
    error NotAttested(bytes32 batchId);
    error ZeroAmount();
    error InvalidRate(uint16 bps);

    /// @notice Seller offers a receivable for factoring at `advanceRateBps` and `feeBps`.
    function offer(
        bytes32 agreementId,
        bytes32 batchId,
        address debtor,
        address token,
        uint256 faceAmount,
        uint16 advanceRateBps,
        uint16 feeBps,
        uint64 maturity,
        bool recourse
    ) external;

    /// @notice Factor funds the agreement, advancing the discounted amount to the seller.
    function fund(bytes32 agreementId) external;

    /// @notice Record collection from the debtor; nets fee to factor, rebates surplus to seller.
    function collect(bytes32 agreementId) external;

    /// @notice Mark a receivable defaulted; charges the seller under recourse agreements.
    function markDefault(bytes32 agreementId) external;

    /// @notice Seller cancels an un-funded offer.
    function cancel(bytes32 agreementId) external;

    function agreementOf(bytes32 agreementId) external view returns (Agreement memory);
}
