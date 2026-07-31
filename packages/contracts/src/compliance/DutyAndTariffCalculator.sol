// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IDutyAndTariffCalculator } from "../interfaces/IDutyAndTariffCalculator.sol";

/// @title DutyAndTariffCalculator
/// @notice Deterministic duty/tariff engine. Governors maintain ad-valorem duty/VAT/excise rates keyed by
///         HS commodity code and origin->destination lane. `assess` computes duty, excise, VAT (charged on
///         the duty-inclusive value) and the total payable; a preferential lane zero-rates the duty.
/// @dev Pure calculator — no funds move here. {CustomsDeclaration} calls `assess` to size the payable duty.
contract DutyAndTariffCalculator is ProofChainAccess, IDutyAndTariffCalculator {
    uint16 private constant BPS = 10_000;

    mapping(bytes32 => DutyRate) private _rates;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial GOVERNOR_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.GOVERNOR_ROLE, admin);
    }

    /// @inheritdoc IDutyAndTariffCalculator
    function setRate(
        bytes32 hsCode,
        bytes32 originCountry,
        bytes32 destinationCountry,
        uint16 dutyBps,
        uint16 vatBps,
        uint16 exciseBps,
        bool preferential
    ) external onlyRole(Roles.GOVERNOR_ROLE) {
        _requireNotGloballyPaused();
        if (dutyBps > BPS) revert InvalidBps(dutyBps);
        if (vatBps > BPS) revert InvalidBps(vatBps);
        if (exciseBps > BPS) revert InvalidBps(exciseBps);

        _rates[_key(hsCode, originCountry, destinationCountry)] = DutyRate({
            dutyBps: dutyBps,
            vatBps: vatBps,
            exciseBps: exciseBps,
            preferential: preferential,
            set: true
        });

        emit RateSet(hsCode, originCountry, destinationCountry, dutyBps, vatBps, exciseBps, preferential);
    }

    /// @inheritdoc IDutyAndTariffCalculator
    function clearRate(bytes32 hsCode, bytes32 originCountry, bytes32 destinationCountry)
        external
        onlyRole(Roles.GOVERNOR_ROLE)
    {
        _requireNotGloballyPaused();
        bytes32 key = _key(hsCode, originCountry, destinationCountry);
        if (!_rates[key].set) revert RateNotSet(hsCode, originCountry, destinationCountry);

        delete _rates[key];
        emit RateCleared(hsCode, originCountry, destinationCountry);
    }

    /// @inheritdoc IDutyAndTariffCalculator
    function rateOf(bytes32 hsCode, bytes32 originCountry, bytes32 destinationCountry)
        external
        view
        returns (DutyRate memory)
    {
        return _rates[_key(hsCode, originCountry, destinationCountry)];
    }

    /// @inheritdoc IDutyAndTariffCalculator
    function assess(bytes32 hsCode, bytes32 originCountry, bytes32 destinationCountry, uint256 customsValue)
        external
        view
        returns (Assessment memory)
    {
        if (customsValue == 0) revert ZeroValue();
        DutyRate memory rate = _rates[_key(hsCode, originCountry, destinationCountry)];
        if (!rate.set) revert RateNotSet(hsCode, originCountry, destinationCountry);

        uint256 duty = rate.preferential ? 0 : (customsValue * rate.dutyBps) / BPS;
        uint256 excise = (customsValue * rate.exciseBps) / BPS;
        // VAT is levied on the duty- and excise-inclusive value (standard landed-cost basis).
        uint256 vat = ((customsValue + duty + excise) * rate.vatBps) / BPS;

        return Assessment({
            customsValue: customsValue,
            dutyAmount: duty,
            vatAmount: vat,
            exciseAmount: excise,
            totalPayable: duty + excise + vat
        });
    }

    /// @dev Lane key for the rate table.
    function _key(bytes32 hsCode, bytes32 originCountry, bytes32 destinationCountry)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(hsCode, originCountry, destinationCountry));
    }
}
