// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICustomsDeclaration
/// @notice On-chain customs declaration lifecycle. A declarant lodges a declaration for a batch (HS code,
///         value, origin/destination); customs assesses duties (via the calculator), the declarant pays,
///         and customs releases or holds the goods. Provides the customs status the compliance engine reads.
/// @dev deps (AddressBook): DutyAndTariffCalculator, CertificateOfOrigin, StablecoinRegistry, Treasury.
interface ICustomsDeclaration {
    enum DeclarationState {
        None,
        Lodged,
        Assessed,
        Paid,
        Released,
        Held,
        Cancelled
    }

    struct Declaration {
        bytes32 declarationId;
        bytes32 batchId;
        address declarant;
        bytes32 hsCode;
        bytes32 originCountry;
        bytes32 destinationCountry;
        uint256 customsValue;
        uint256 dutyAssessed;
        address token;
        DeclarationState state;
    }

    event Lodged(bytes32 indexed declarationId, bytes32 indexed batchId, address indexed declarant, bytes32 hsCode, uint256 customsValue);
    event Assessed(bytes32 indexed declarationId, uint256 dutyAssessed);
    event Paid(bytes32 indexed declarationId, uint256 amount);
    event Released(bytes32 indexed declarationId);
    event Held(bytes32 indexed declarationId, string reason);
    event Cancelled(bytes32 indexed declarationId);

    error DeclarationExists(bytes32 declarationId);
    error UnknownDeclaration(bytes32 declarationId);
    error InvalidState(bytes32 declarationId, DeclarationState expected, DeclarationState actual);
    error NotDeclarant(bytes32 declarationId);
    error ZeroValue();

    /// @notice Declarant lodges a customs declaration for a batch.
    function lodge(
        bytes32 declarationId,
        bytes32 batchId,
        bytes32 hsCode,
        bytes32 originCountry,
        bytes32 destinationCountry,
        uint256 customsValue,
        address token
    ) external;

    /// @notice Customs assesses duty via the calculator. CUSTOMS_ROLE only.
    function assess(bytes32 declarationId) external returns (uint256 dutyAssessed);

    /// @notice Declarant pays the assessed duty to the treasury.
    function payDuty(bytes32 declarationId) external;

    /// @notice Customs releases the goods after payment. CUSTOMS_ROLE only.
    function release(bytes32 declarationId) external;

    /// @notice Customs holds a declaration for inspection. CUSTOMS_ROLE only.
    function hold(bytes32 declarationId, string calldata reason) external;

    /// @notice Cancel a lodged declaration before release.
    function cancel(bytes32 declarationId) external;

    /// @notice True if the declaration is Released.
    function isReleased(bytes32 declarationId) external view returns (bool);

    function declarationOf(bytes32 declarationId) external view returns (Declaration memory);
}
