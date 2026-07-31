// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IDutyAndTariffCalculator
/// @notice Deterministic duty/tariff engine. Admins maintain ad-valorem duty rates keyed by HS commodity
///         code and origin->destination lane, plus VAT/excise rates. Given a customs value it computes the
///         payable duty, VAT and total landed cost; preferential origin can zero-rate a lane.
/// @dev deps (AddressBook): CertificateOfOrigin, CustomsDeclaration.
interface IDutyAndTariffCalculator {
    struct DutyRate {
        uint16 dutyBps;
        uint16 vatBps;
        uint16 exciseBps;
        bool preferential;
        bool set;
    }

    struct Assessment {
        uint256 customsValue;
        uint256 dutyAmount;
        uint256 vatAmount;
        uint256 exciseAmount;
        uint256 totalPayable;
    }

    event RateSet(
        bytes32 indexed hsCode, bytes32 indexed originCountry, bytes32 indexed destinationCountry, uint16 dutyBps, uint16 vatBps, uint16 exciseBps, bool preferential
    );
    event RateCleared(bytes32 indexed hsCode, bytes32 indexed originCountry, bytes32 indexed destinationCountry);

    error RateNotSet(bytes32 hsCode, bytes32 originCountry, bytes32 destinationCountry);
    error InvalidBps(uint16 bps);
    error ZeroValue();

    /// @notice Set the duty/VAT/excise rates for an HS code and origin->destination lane. GOVERNOR_ROLE.
    function setRate(
        bytes32 hsCode,
        bytes32 originCountry,
        bytes32 destinationCountry,
        uint16 dutyBps,
        uint16 vatBps,
        uint16 exciseBps,
        bool preferential
    ) external;

    /// @notice Remove a configured rate lane.
    function clearRate(bytes32 hsCode, bytes32 originCountry, bytes32 destinationCountry) external;

    /// @notice Return the configured rate for a lane.
    function rateOf(bytes32 hsCode, bytes32 originCountry, bytes32 destinationCountry)
        external
        view
        returns (DutyRate memory);

    /// @notice Compute duty, VAT, excise and total payable for a customs value on a lane.
    function assess(bytes32 hsCode, bytes32 originCountry, bytes32 destinationCountry, uint256 customsValue)
        external
        view
        returns (Assessment memory);
}
