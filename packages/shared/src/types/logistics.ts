/**
 * `logistics` domain types.
 *
 * Mirrors the on-chain structs, events, and status enums of the contracts in
 * `packages/contracts/src/logistics/` and their `interfaces/`:
 * `FreightBooking`, `ColdChainMonitor`, `BondedWarehouse`, `FleetRegistry`,
 * `RouteAttestation`, `CustomsBonded`, `ContainerRegistry`,
 * `LastMileProofOfDelivery`.
 *
 * Conventions (see `./core`): every field `readonly`; `bigint` for
 * uint256/uint64/int256; `number` for uint8/uint16/uint32; branded `Address` /
 * `Bytes32`. Numeric enum values MUST match the Solidity `enum` order exactly.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Mirror of `IFreightBooking.Mode`. */
export enum FreightMode {
  Sea = 0,
  Air = 1,
  Road = 2,
  Rail = 3,
  Multimodal = 4,
}

export const FREIGHT_MODE_LABELS: Readonly<Record<FreightMode, string>> =
  Object.freeze({
    [FreightMode.Sea]: "Sea",
    [FreightMode.Air]: "Air",
    [FreightMode.Road]: "Road",
    [FreightMode.Rail]: "Rail",
    [FreightMode.Multimodal]: "Multimodal",
  });

/** Mirror of `IFreightBooking.BookingState`. */
export enum BookingState {
  None = 0,
  Requested = 1,
  Confirmed = 2,
  Paid = 3,
  InTransit = 4,
  Delivered = 5,
  Cancelled = 6,
}

export const BOOKING_STATE_LABELS: Readonly<Record<BookingState, string>> =
  Object.freeze({
    [BookingState.None]: "None",
    [BookingState.Requested]: "Requested",
    [BookingState.Confirmed]: "Confirmed",
    [BookingState.Paid]: "Paid",
    [BookingState.InTransit]: "InTransit",
    [BookingState.Delivered]: "Delivered",
    [BookingState.Cancelled]: "Cancelled",
  });

/** Mirror of `IBondedWarehouse.LotState`. */
export enum BondedLotState {
  None = 0,
  Bonded = 1,
  DutyPaid = 2,
  ReExported = 3,
  Released = 4,
}

export const BONDED_LOT_STATE_LABELS: Readonly<Record<BondedLotState, string>> =
  Object.freeze({
    [BondedLotState.None]: "None",
    [BondedLotState.Bonded]: "Bonded",
    [BondedLotState.DutyPaid]: "DutyPaid",
    [BondedLotState.ReExported]: "ReExported",
    [BondedLotState.Released]: "Released",
  });

/** Mirror of `IFleetRegistry.AssetType`. */
export enum AssetType {
  Truck = 0,
  Reefer = 1,
  Van = 2,
  Vessel = 3,
  Aircraft = 4,
  RailCar = 5,
}

export const ASSET_TYPE_LABELS: Readonly<Record<AssetType, string>> =
  Object.freeze({
    [AssetType.Truck]: "Truck",
    [AssetType.Reefer]: "Reefer",
    [AssetType.Van]: "Van",
    [AssetType.Vessel]: "Vessel",
    [AssetType.Aircraft]: "Aircraft",
    [AssetType.RailCar]: "RailCar",
  });

/** Mirror of `IFleetRegistry.AssetState`. */
export enum AssetState {
  None = 0,
  Active = 1,
  Maintenance = 2,
  Decommissioned = 3,
}

export const ASSET_STATE_LABELS: Readonly<Record<AssetState, string>> =
  Object.freeze({
    [AssetState.None]: "None",
    [AssetState.Active]: "Active",
    [AssetState.Maintenance]: "Maintenance",
    [AssetState.Decommissioned]: "Decommissioned",
  });

/** Mirror of `IRouteAttestation.RouteState`. */
export enum RouteState {
  None = 0,
  Planned = 1,
  InProgress = 2,
  Completed = 3,
  Deviated = 4,
  Cancelled = 5,
}

export const ROUTE_STATE_LABELS: Readonly<Record<RouteState, string>> =
  Object.freeze({
    [RouteState.None]: "None",
    [RouteState.Planned]: "Planned",
    [RouteState.InProgress]: "InProgress",
    [RouteState.Completed]: "Completed",
    [RouteState.Deviated]: "Deviated",
    [RouteState.Cancelled]: "Cancelled",
  });

/** Mirror of `ICustomsBonded.BondType`. */
export enum CustomsBondType {
  SingleEntry = 0,
  Continuous = 1,
  Warehouse = 2,
  Transit = 3,
}

export const CUSTOMS_BOND_TYPE_LABELS: Readonly<
  Record<CustomsBondType, string>
> = Object.freeze({
  [CustomsBondType.SingleEntry]: "SingleEntry",
  [CustomsBondType.Continuous]: "Continuous",
  [CustomsBondType.Warehouse]: "Warehouse",
  [CustomsBondType.Transit]: "Transit",
});

/** Mirror of `ICustomsBonded.BondState`. */
export enum CustomsBondState {
  None = 0,
  Active = 1,
  Drawn = 2,
  Exhausted = 3,
  Released = 4,
  Revoked = 5,
}

export const CUSTOMS_BOND_STATE_LABELS: Readonly<
  Record<CustomsBondState, string>
> = Object.freeze({
  [CustomsBondState.None]: "None",
  [CustomsBondState.Active]: "Active",
  [CustomsBondState.Drawn]: "Drawn",
  [CustomsBondState.Exhausted]: "Exhausted",
  [CustomsBondState.Released]: "Released",
  [CustomsBondState.Revoked]: "Revoked",
});

/** Mirror of `IContainerRegistry.ContainerStatus`. */
export enum ContainerStatus {
  None = 0,
  Available = 1,
  Assigned = 2,
  Sealed = 3,
  InTransit = 4,
  Discharged = 5,
  Retired = 6,
}

export const CONTAINER_STATUS_LABELS: Readonly<
  Record<ContainerStatus, string>
> = Object.freeze({
  [ContainerStatus.None]: "None",
  [ContainerStatus.Available]: "Available",
  [ContainerStatus.Assigned]: "Assigned",
  [ContainerStatus.Sealed]: "Sealed",
  [ContainerStatus.InTransit]: "InTransit",
  [ContainerStatus.Discharged]: "Discharged",
  [ContainerStatus.Retired]: "Retired",
});

/** Mirror of `ILastMileProofOfDelivery.DeliveryState`. */
export enum DeliveryState {
  None = 0,
  Dispatched = 1,
  Delivered = 2,
  Failed = 3,
  Disputed = 4,
}

export const DELIVERY_STATE_LABELS: Readonly<Record<DeliveryState, string>> =
  Object.freeze({
    [DeliveryState.None]: "None",
    [DeliveryState.Dispatched]: "Dispatched",
    [DeliveryState.Delivered]: "Delivered",
    [DeliveryState.Failed]: "Failed",
    [DeliveryState.Disputed]: "Disputed",
  });

// ---------------------------------------------------------------------------
// On-chain struct mirrors
// ---------------------------------------------------------------------------

/** Mirror of `IFreightBooking.Booking`. */
export interface FreightBooking {
  readonly bookingId: Bytes32;
  readonly batchId: Bytes32;
  readonly shipper: Address;
  readonly carrier: Address;
  readonly mode: FreightMode;
  readonly origin: Bytes32;
  readonly destination: Bytes32;
  readonly token: Address;
  readonly freightAmount: bigint;
  readonly etd: bigint; // uint64
  readonly eta: bigint; // uint64
  readonly state: BookingState;
}

/** Mirror of `IColdChainMonitor.Profile`. */
export interface ColdChainProfile {
  readonly batchId: Bytes32;
  readonly minTemp: bigint; // int256 (milli-degrees etc., signed)
  readonly maxTemp: bigint; // int256
  readonly maxHumidityBps: number; // uint16
  readonly breachCount: number; // uint32
  readonly breached: boolean;
  readonly active: boolean;
}

/** Mirror of `IColdChainMonitor.Reading`. */
export interface ColdChainReading {
  readonly temp: bigint; // int256
  readonly humidityBps: number; // uint16
  readonly dataHash: Bytes32;
  readonly timestamp: bigint; // uint64
  readonly breach: boolean;
}

/** Mirror of `IBondedWarehouse.Warehouse`. */
export interface BondedWarehouseFacility {
  readonly warehouseId: Bytes32;
  readonly operator: Address;
  readonly customsBondId: Bytes32;
  readonly location: Bytes32;
  readonly active: boolean;
}

/** Mirror of `IBondedWarehouse.BondedLot`. */
export interface BondedLot {
  readonly lotId: Bytes32;
  readonly warehouseId: Bytes32;
  readonly batchId: Bytes32;
  readonly owner: Address;
  readonly quantity: bigint;
  readonly depositedAt: bigint; // uint64
  readonly state: BondedLotState;
}

/** Mirror of `IFleetRegistry.Asset`. */
export interface FleetAsset {
  readonly assetId: Bytes32;
  readonly carrier: Address;
  readonly assetType: AssetType;
  readonly capacityKg: bigint;
  readonly emissionClass: number; // uint16
  readonly deviceKey: Address;
  readonly state: AssetState;
}

/** Mirror of `IRouteAttestation.Waypoint`. */
export interface Waypoint {
  readonly geohash: Bytes32;
  readonly plannedEta: bigint; // uint64
  readonly reachedAt: bigint; // uint64
  readonly reached: boolean;
}

/** Mirror of `IRouteAttestation.Route`. */
export interface Route {
  readonly routeId: Bytes32;
  readonly bookingId: Bytes32;
  readonly assetId: Bytes32;
  readonly waypointCount: number; // uint16
  readonly reachedCount: number; // uint16
  readonly deviationCount: number; // uint16
  readonly state: RouteState;
}

/** Mirror of `ICustomsBonded.CustomsBond`. */
export interface CustomsBond {
  readonly bondId: Bytes32;
  readonly bondType: CustomsBondType;
  readonly principal: Address;
  readonly surety: Address;
  readonly authority: Bytes32;
  readonly token: Address;
  readonly coverageAmount: bigint;
  readonly drawnAmount: bigint;
  readonly effectiveFrom: bigint; // uint64
  readonly expiresAt: bigint; // uint64
  readonly state: CustomsBondState;
}

/** Mirror of `IContainerRegistry.Container`. */
export interface Container {
  readonly containerId: Bytes32;
  readonly owner: Address;
  readonly isoType: Bytes32;
  readonly tareKg: number; // uint32
  readonly maxGrossKg: number; // uint32
  readonly status: ContainerStatus;
  readonly bookingId: Bytes32;
  readonly batchId: Bytes32;
  readonly sealId: Bytes32;
}

/** Mirror of `ILastMileProofOfDelivery.Delivery`. */
export interface Delivery {
  readonly deliveryId: Bytes32;
  readonly bookingId: Bytes32;
  readonly courier: Address;
  readonly recipient: Address;
  readonly otpCommit: Bytes32;
  readonly geohash: Bytes32;
  readonly proofHash: Bytes32;
  readonly dispatchedAt: bigint; // uint64
  readonly deliveredAt: bigint; // uint64
  readonly state: DeliveryState;
  readonly attempts: number; // uint8
}

// ---------------------------------------------------------------------------
// Event payload mirrors (decoded by `../decoders/logistics`)
// ---------------------------------------------------------------------------

/** Payload of `FreightBooking.Requested`. */
export interface FreightRequestedEvent {
  readonly bookingId: Bytes32;
  readonly batchId: Bytes32;
  readonly shipper: Address;
  readonly carrier: Address;
  readonly mode: FreightMode;
}

/** Payload of `FreightBooking.Confirmed`. */
export interface FreightConfirmedEvent {
  readonly bookingId: Bytes32;
  readonly freightAmount: bigint;
  readonly etd: bigint;
  readonly eta: bigint;
}

/** Payload of `ColdChainMonitor.ReadingRecorded`. */
export interface ColdChainReadingRecordedEvent {
  readonly batchId: Bytes32;
  readonly index: bigint;
  readonly temp: bigint;
  readonly humidityBps: number;
  readonly breach: boolean;
}

/** Payload of `ColdChainMonitor.Breached`. */
export interface ColdChainBreachedEvent {
  readonly batchId: Bytes32;
  readonly temp: bigint;
  readonly humidityBps: number;
  readonly breachCount: number;
}

/** Payload of `BondedWarehouse.Deposited`. */
export interface BondedLotDepositedEvent {
  readonly lotId: Bytes32;
  readonly warehouseId: Bytes32;
  readonly batchId: Bytes32;
  readonly owner: Address;
  readonly quantity: bigint;
}

/** Payload of `FleetRegistry.AssetRegistered`. */
export interface FleetAssetRegisteredEvent {
  readonly assetId: Bytes32;
  readonly carrier: Address;
  readonly assetType: AssetType;
  readonly capacityKg: bigint;
}

/** Payload of `RouteAttestation.WaypointReached`. */
export interface WaypointReachedEvent {
  readonly routeId: Bytes32;
  readonly index: number; // uint16 indexed
  readonly geohash: Bytes32;
  readonly reachedAt: bigint;
}

/** Payload of `CustomsBonded.BondDrawn`. */
export interface CustomsBondDrawnEvent {
  readonly bondId: Bytes32;
  readonly declarationId: Bytes32;
  readonly amount: bigint;
  readonly drawnTotal: bigint;
}

/** Payload of `ContainerRegistry.ContainerSealed`. */
export interface ContainerSealedEvent {
  readonly containerId: Bytes32;
  readonly batchId: Bytes32;
  readonly sealId: Bytes32;
}

/** Payload of `LastMileProofOfDelivery.Delivered`. */
export interface LastMileDeliveredEvent {
  readonly deliveryId: Bytes32;
  readonly geohash: Bytes32;
  readonly proofHash: Bytes32;
  readonly deliveredAt: bigint;
}

// ---------------------------------------------------------------------------
// Request / response DTOs (consumed by api + web)
// ---------------------------------------------------------------------------

/** Filter parameters for a freight-booking listing endpoint. */
export interface FreightBookingListQuery {
  readonly shipper?: Address;
  readonly carrier?: Address;
  readonly batchId?: Bytes32;
  readonly mode?: FreightMode;
  readonly state?: BookingState;
  readonly limit?: number;
  readonly cursor?: string;
}

/** Denormalized freight-booking row for list/detail views. */
export interface FreightBookingSummary {
  readonly bookingId: Bytes32;
  readonly batchId: Bytes32;
  readonly shipper: Address;
  readonly carrier: Address;
  readonly mode: FreightMode;
  readonly modeLabel: string;
  readonly state: BookingState;
  readonly stateLabel: string;
  readonly freightAmount: bigint;
  readonly etd: bigint;
  readonly eta: bigint;
  readonly coldChainBreached: boolean;
}

/** Compact cold-chain health view for a batch. */
export interface ColdChainStatus {
  readonly batchId: Bytes32;
  readonly active: boolean;
  readonly breached: boolean;
  readonly breachCount: number;
  readonly readingCount: number;
  readonly lastReading: ColdChainReading | null;
}
