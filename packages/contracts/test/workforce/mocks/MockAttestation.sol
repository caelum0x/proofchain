// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Test double exposing the {IAttestationRegistry} reads the workforce module relies on.
contract MockAttestation {
    mapping(bytes32 => bool) private _attested;

    function setAttested(bytes32 id, bool attested_) external {
        _attested[id] = attested_;
    }

    function isAttested(bytes32 id) external view returns (bool) {
        return _attested[id];
    }
}
