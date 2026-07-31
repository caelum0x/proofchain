// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICustomsBonded
/// @notice Registry of customs surety bonds that guarantee an importer's duties, taxes and penalties to a
///         customs authority. A principal (importer) posts a bond backed by a surety for a coverage amount;
///         customs can draw against it on default and the surety is released once obligations are settled.
/// @dev deps (AddressBook): CustomsDeclaration, DutyAndTariffCalculator, StablecoinRegistry, SettlementEscrow.
interface ICustomsBonded {
    enum BondType {
        SingleEntry,
        Continuous,
        Warehouse,
        Transit
    }

    enum BondState {
        None,
        Active,
        Drawn,
        Exhausted,
        Released,
        Revoked
    }

    struct CustomsBond {
        bytes32 bondId;
        BondType bondType;
        address principal;
        address surety;
        bytes32 authority;
        address token;
        uint256 coverageAmount;
        uint256 drawnAmount;
        uint64 effectiveFrom;
        uint64 expiresAt;
        BondState state;
    }

    event BondPosted(
        bytes32 indexed bondId,
        BondType bondType,
        address indexed principal,
        address indexed surety,
        bytes32 authority,
        uint256 coverageAmount
    );
    event BondDrawn(bytes32 indexed bondId, bytes32 indexed declarationId, uint256 amount, uint256 drawnTotal);
    event BondReleased(bytes32 indexed bondId);
    event BondRevoked(bytes32 indexed bondId, bytes32 reason);

    error BondExists(bytes32 bondId);
    error UnknownBond(bytes32 bondId);
    error InvalidState(bytes32 bondId, BondState expected, BondState actual);
    error NotSurety(bytes32 bondId);
    error ZeroCoverage();
    error InvalidWindow(uint64 effectiveFrom, uint64 expiresAt);
    error CoverageExceeded(bytes32 bondId, uint256 requested, uint256 remaining);

    /// @notice Post a customs bond backed by a surety's collateral. CUSTOMS_ROLE registers; surety funds coverage.
    function postBond(
        bytes32 bondId,
        BondType bondType,
        address principal,
        address surety,
        bytes32 authority,
        address token,
        uint256 coverageAmount,
        uint64 effectiveFrom,
        uint64 expiresAt
    ) external;

    /// @notice Draw against a bond to cover a defaulted declaration's duties. CUSTOMS_ROLE only.
    function draw(bytes32 bondId, bytes32 declarationId, uint256 amount) external;

    /// @notice Release the bond and return remaining collateral to the surety after obligations settle.
    function release(bytes32 bondId) external;

    /// @notice Revoke an active bond (fraud/non-compliance). CUSTOMS_ROLE only.
    function revoke(bytes32 bondId, bytes32 reason) external;

    /// @notice Remaining undrawn coverage on a bond.
    function remainingCoverage(bytes32 bondId) external view returns (uint256);

    function bondOf(bytes32 bondId) external view returns (CustomsBond memory);
}
