// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ILetterOfCredit
/// @notice Documentary Letter of Credit: an issuing bank opens an irrevocable undertaking to pay a
///         beneficiary (exporter) against compliant document presentation for a batch. Funds are held
///         and released on AI-verified document acceptance; the applicant (importer) is the account party.
/// @dev deps (AddressBook): AttestationRegistry, SettlementEscrow, StablecoinRegistry, ComplianceEngine.
///      Fund movements pull `amount` of `token` from the issuer and pay the beneficiary on settlement.
interface ILetterOfCredit {
    enum LCState {
        None,
        Issued,
        DocumentsPresented,
        Accepted,
        Paid,
        Rejected,
        Expired,
        Cancelled
    }

    struct Credit {
        bytes32 lcId;
        bytes32 batchId;
        address applicant;
        address beneficiary;
        address issuer;
        address token;
        uint256 amount;
        uint64 expiry;
        bytes32 termsHash;
        bytes32 documentsHash;
        LCState state;
    }

    event Issued(
        bytes32 indexed lcId,
        bytes32 indexed batchId,
        address indexed beneficiary,
        address applicant,
        address token,
        uint256 amount,
        uint64 expiry
    );
    event DocumentsPresented(bytes32 indexed lcId, bytes32 documentsHash, address indexed by);
    event Accepted(bytes32 indexed lcId, address indexed by);
    event Rejected(bytes32 indexed lcId, string reason);
    event Paid(bytes32 indexed lcId, address indexed beneficiary, uint256 amount);
    event Expired(bytes32 indexed lcId);
    event Cancelled(bytes32 indexed lcId);

    error CreditExists(bytes32 lcId);
    error UnknownCredit(bytes32 lcId);
    error InvalidState(bytes32 lcId, LCState expected, LCState actual);
    error NotBeneficiary(bytes32 lcId);
    error NotApplicant(bytes32 lcId);
    error NotIssuer(bytes32 lcId);
    error ZeroAmount();
    error PastExpiry(uint64 expiry);
    error CreditExpired(bytes32 lcId);
    error DocumentsNotAttested(bytes32 lcId);

    /// @notice Issuing bank opens an LC, escrowing `amount` of `token`. UNDERWRITER_ROLE only.
    function issue(
        bytes32 lcId,
        bytes32 batchId,
        address applicant,
        address beneficiary,
        address token,
        uint256 amount,
        uint64 expiry,
        bytes32 termsHash
    ) external;

    /// @notice Beneficiary presents shipping documents committing to `documentsHash`.
    function presentDocuments(bytes32 lcId, bytes32 documentsHash) external;

    /// @notice Accept presented documents (AI-verified compliant) and pay the beneficiary.
    function accept(bytes32 lcId) external;

    /// @notice Reject presented documents as discrepant.
    function reject(bytes32 lcId, string calldata reason) external;

    /// @notice Mark an LC expired after `expiry`, returning escrow to the applicant.
    function expire(bytes32 lcId) external;

    /// @notice Cancel an issued LC before any presentation (mutual/applicant action).
    function cancel(bytes32 lcId) external;

    function creditOf(bytes32 lcId) external view returns (Credit memory);
    function stateOf(bytes32 lcId) external view returns (LCState);
}
