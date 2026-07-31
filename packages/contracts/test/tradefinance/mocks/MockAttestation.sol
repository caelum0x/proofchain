// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Test double exposing the {IAttestationRegistry} reads the tradefinance module relies on.
contract MockAttestation {
    mapping(bytes32 => bool) private _attested;
    mapping(bytes32 => uint16) private _score;

    function setAttested(bytes32 batchId, bool attested_, uint16 score_) external {
        _attested[batchId] = attested_;
        _score[batchId] = score_;
    }

    function isAttested(bytes32 batchId) external view returns (bool) {
        return _attested[batchId];
    }

    function scoreOf(bytes32 batchId) external view returns (uint16) {
        return _score[batchId];
    }
}
