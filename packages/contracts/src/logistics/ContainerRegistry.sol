// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IContainerRegistry } from "../interfaces/IContainerRegistry.sol";

/// @title ContainerRegistry
/// @notice Registry of intermodal shipping containers keyed by their ISO 6346 container number.
///         Tracks owner, ISO type, tare/gross weights, and lifecycle status, plus assignment to a
///         freight booking and sealing of the container to a batch with a tamper-evident seal id.
/// @dev Deps resolved via the {AddressBook}. Registration is open to `REGISTRAR_ROLE` or the
///      declared owner; all subsequent mutations are owner-gated. Status transitions are validated
///      so a container cannot skip its physical lifecycle.
contract ContainerRegistry is ProofChainAccess, IContainerRegistry {
    mapping(bytes32 => Container) private _containers;

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IContainerRegistry
    function registerContainer(bytes32 containerId, address owner, bytes32 isoType, uint32 tareKg, uint32 maxGrossKg)
        external
    {
        _requireNotGloballyPaused();
        if (owner == address(0)) revert ZeroAddress();
        if (!hasRole(Roles.REGISTRAR_ROLE, msg.sender) && msg.sender != owner) revert NotOwner(containerId);
        if (_containers[containerId].status != ContainerStatus.None) revert ContainerExists(containerId);
        if (maxGrossKg == 0 || tareKg >= maxGrossKg) revert InvalidWeights(tareKg, maxGrossKg);

        _containers[containerId] = Container({
            containerId: containerId,
            owner: owner,
            isoType: isoType,
            tareKg: tareKg,
            maxGrossKg: maxGrossKg,
            status: ContainerStatus.Available,
            bookingId: bytes32(0),
            batchId: bytes32(0),
            sealId: bytes32(0)
        });

        emit ContainerRegistered(containerId, owner, isoType, tareKg);
    }

    /// @inheritdoc IContainerRegistry
    function assign(bytes32 containerId, bytes32 bookingId) external {
        _requireNotGloballyPaused();
        Container storage c = _requireOwner(containerId);
        if (c.status != ContainerStatus.Available) {
            revert InvalidStatus(containerId, ContainerStatus.Available, c.status);
        }

        c.bookingId = bookingId;
        c.status = ContainerStatus.Assigned;
        emit ContainerAssigned(containerId, bookingId);
        emit StatusChanged(containerId, ContainerStatus.Assigned);
    }

    /// @inheritdoc IContainerRegistry
    function seal(bytes32 containerId, bytes32 batchId, bytes32 sealId) external {
        _requireNotGloballyPaused();
        Container storage c = _requireOwner(containerId);
        if (c.status != ContainerStatus.Assigned) {
            revert InvalidStatus(containerId, ContainerStatus.Assigned, c.status);
        }
        if (sealId == bytes32(0)) revert ZeroSeal();

        c.batchId = batchId;
        c.sealId = sealId;
        c.status = ContainerStatus.Sealed;
        emit ContainerSealed(containerId, batchId, sealId);
        emit StatusChanged(containerId, ContainerStatus.Sealed);
    }

    /// @inheritdoc IContainerRegistry
    function setStatus(bytes32 containerId, ContainerStatus status) external {
        _requireNotGloballyPaused();
        Container storage c = _requireOwner(containerId);
        // Only the in-transit → discharged leg is driven here; earlier lifecycle stages have
        // dedicated entrypoints (assign/seal) and Retired has its own function.
        if (status == ContainerStatus.InTransit) {
            if (c.status != ContainerStatus.Sealed) {
                revert InvalidStatus(containerId, ContainerStatus.Sealed, c.status);
            }
        } else if (status == ContainerStatus.Discharged) {
            if (c.status != ContainerStatus.InTransit) {
                revert InvalidStatus(containerId, ContainerStatus.InTransit, c.status);
            }
        } else {
            revert InvalidStatus(containerId, ContainerStatus.InTransit, status);
        }

        c.status = status;
        emit StatusChanged(containerId, status);
    }

    /// @inheritdoc IContainerRegistry
    function transferOwner(bytes32 containerId, address newOwner) external {
        _requireNotGloballyPaused();
        if (newOwner == address(0)) revert ZeroAddress();
        Container storage c = _requireOwner(containerId);

        c.owner = newOwner;
        emit OwnerChanged(containerId, newOwner);
    }

    /// @inheritdoc IContainerRegistry
    function retire(bytes32 containerId) external {
        _requireNotGloballyPaused();
        Container storage c = _requireOwner(containerId);
        if (c.status == ContainerStatus.Retired) {
            revert InvalidStatus(containerId, ContainerStatus.Available, c.status);
        }

        c.status = ContainerStatus.Retired;
        emit ContainerRetired(containerId);
        emit StatusChanged(containerId, ContainerStatus.Retired);
    }

    /// @inheritdoc IContainerRegistry
    function containerOf(bytes32 containerId) external view returns (Container memory) {
        return _containers[containerId];
    }

    // --------------------------------------------------------------------- internal

    function _requireOwner(bytes32 containerId) private view returns (Container storage c) {
        c = _containers[containerId];
        if (c.status == ContainerStatus.None) revert UnknownContainer(containerId);
        if (msg.sender != c.owner) revert NotOwner(containerId);
    }
}
