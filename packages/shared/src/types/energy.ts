/**
 * `energy` domain types.
 *
 * TypeScript mirrors of the on-chain structs, enums and status values used by
 * the `src/energy/` contracts (RenewableEnergyCertificate, EmissionsTrading,
 * WaterCredit, BiodiversityCredit, GreenBondIssuer) plus the request DTOs the
 * api/web use to drive their write paths.
 *
 * Numeric enum values MUST match the Solidity `enum` declaration order exactly —
 * they are read straight off-chain. Every field is `readonly`; `bigint` mirrors
 * uint256/uint64/int256, `number` mirrors uint8/uint16/uint32.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// RenewableEnergyCertificate (ERC1155 RECs / Guarantees of Origin)
// ---------------------------------------------------------------------------

/** Mirror of `IRenewableEnergyCertificate.EnergySource`. */
export enum EnergySource {
  Solar = 0,
  Wind = 1,
  Hydro = 2,
  Geothermal = 3,
  Biomass = 4,
  Nuclear = 5,
}

export const ENERGY_SOURCE_LABELS: Readonly<Record<EnergySource, string>> =
  Object.freeze({
    [EnergySource.Solar]: "Solar",
    [EnergySource.Wind]: "Wind",
    [EnergySource.Hydro]: "Hydro",
    [EnergySource.Geothermal]: "Geothermal",
    [EnergySource.Biomass]: "Biomass",
    [EnergySource.Nuclear]: "Nuclear",
  });

/** Mirror of `IRenewableEnergyCertificate.Certificate`. */
export interface RenewableCertificate {
  readonly tokenId: bigint;
  readonly facilityId: Bytes32;
  readonly source: EnergySource;
  readonly vintageYear: number; // uint16
  readonly issuedMwh: bigint;
  readonly retiredMwh: bigint;
}

// ---------------------------------------------------------------------------
// EmissionsTrading (cap-and-trade allowance ledger)
// ---------------------------------------------------------------------------

/** Mirror of `IEmissionsTrading.PeriodState`. */
export enum EmissionsPeriodState {
  None = 0,
  Open = 1,
  Reconciling = 2,
  Closed = 3,
}

export const EMISSIONS_PERIOD_STATE_LABELS: Readonly<
  Record<EmissionsPeriodState, string>
> = Object.freeze({
  [EmissionsPeriodState.None]: "None",
  [EmissionsPeriodState.Open]: "Open",
  [EmissionsPeriodState.Reconciling]: "Reconciling",
  [EmissionsPeriodState.Closed]: "Closed",
});

/** Mirror of `IEmissionsTrading.Period`. */
export interface EmissionsPeriod {
  readonly periodId: Bytes32;
  readonly cap: bigint;
  readonly allocated: bigint;
  readonly startsAt: bigint; // uint64
  readonly endsAt: bigint; // uint64
  readonly state: EmissionsPeriodState;
}

/** Mirror of `IEmissionsTrading.Account`. */
export interface EmissionsAccount {
  readonly balance: bigint;
  readonly reportedEmissions: bigint;
  readonly surrendered: bigint;
}

// ---------------------------------------------------------------------------
// WaterCredit (volumetric water benefit credits)
// ---------------------------------------------------------------------------

/** Mirror of `IWaterCredit.ProjectState`. */
export enum WaterProjectState {
  None = 0,
  Registered = 1,
  Verified = 2,
  Suspended = 3,
}

export const WATER_PROJECT_STATE_LABELS: Readonly<
  Record<WaterProjectState, string>
> = Object.freeze({
  [WaterProjectState.None]: "None",
  [WaterProjectState.Registered]: "Registered",
  [WaterProjectState.Verified]: "Verified",
  [WaterProjectState.Suspended]: "Suspended",
});

/** Mirror of `IWaterCredit.Project`. */
export interface WaterProject {
  readonly projectId: Bytes32;
  readonly steward: Address;
  readonly basin: Bytes32;
  readonly methodology: Bytes32;
  readonly issued: bigint;
  readonly retired: bigint;
  readonly state: WaterProjectState;
}

// ---------------------------------------------------------------------------
// BiodiversityCredit (nature / biodiversity uplift credits)
// ---------------------------------------------------------------------------

/** Mirror of `IBiodiversityCredit.ProjectState`. */
export enum BiodiversityProjectState {
  None = 0,
  Registered = 1,
  Verified = 2,
  Suspended = 3,
}

export const BIODIVERSITY_PROJECT_STATE_LABELS: Readonly<
  Record<BiodiversityProjectState, string>
> = Object.freeze({
  [BiodiversityProjectState.None]: "None",
  [BiodiversityProjectState.Registered]: "Registered",
  [BiodiversityProjectState.Verified]: "Verified",
  [BiodiversityProjectState.Suspended]: "Suspended",
});

/** Mirror of `IBiodiversityCredit.Project`. */
export interface BiodiversityProject {
  readonly projectId: Bytes32;
  readonly steward: Address;
  readonly habitat: Bytes32;
  readonly geohash: Bytes32;
  readonly methodology: Bytes32;
  readonly areaHectares: number; // uint32
  readonly issued: bigint;
  readonly retired: bigint;
  readonly state: BiodiversityProjectState;
}

// ---------------------------------------------------------------------------
// GreenBondIssuer (use-of-proceeds green bonds)
// ---------------------------------------------------------------------------

/** Mirror of `IGreenBondIssuer.BondState`. */
export enum BondState {
  None = 0,
  Offering = 1,
  Active = 2,
  Defaulted = 3,
  Matured = 4,
  Cancelled = 5,
}

export const BOND_STATE_LABELS: Readonly<Record<BondState, string>> =
  Object.freeze({
    [BondState.None]: "None",
    [BondState.Offering]: "Offering",
    [BondState.Active]: "Active",
    [BondState.Defaulted]: "Defaulted",
    [BondState.Matured]: "Matured",
    [BondState.Cancelled]: "Cancelled",
  });

/** Mirror of `IGreenBondIssuer.Bond`. */
export interface GreenBond {
  readonly bondId: Bytes32;
  readonly issuer: Address;
  readonly token: Address;
  readonly principalTarget: bigint;
  readonly principalRaised: bigint;
  readonly couponBps: number; // uint16
  readonly tenorDays: number; // uint32
  readonly couponPeriods: number; // uint32
  readonly greenCategory: Bytes32;
  readonly issuedAt: bigint; // uint64
  readonly maturesAt: bigint; // uint64
  readonly state: BondState;
}

/** Mirror of `IGreenBondIssuer.Holding`. */
export interface GreenBondHolding {
  readonly principal: bigint;
  readonly couponsClaimed: bigint;
  readonly redeemed: boolean;
}

// ---------------------------------------------------------------------------
// Request DTOs (api/web write paths)
// ---------------------------------------------------------------------------

export interface RegisterRecClassInput {
  readonly tokenId: bigint;
  readonly facilityId: Bytes32;
  readonly source: EnergySource;
  readonly vintageYear: number;
}

export interface IssueRecInput {
  readonly to: Address;
  readonly tokenId: bigint;
  readonly mwh: bigint;
}

export interface RetireRecInput {
  readonly tokenId: bigint;
  readonly mwh: bigint;
  readonly beneficiary: Bytes32;
}

export interface OpenEmissionsPeriodInput {
  readonly periodId: Bytes32;
  readonly cap: bigint;
  readonly startsAt: bigint;
  readonly endsAt: bigint;
}

export interface AllocateAllowanceInput {
  readonly periodId: Bytes32;
  readonly installation: Address;
  readonly amount: bigint;
}

export interface RegisterWaterProjectInput {
  readonly projectId: Bytes32;
  readonly steward: Address;
  readonly basin: Bytes32;
  readonly methodology: Bytes32;
}

export interface RegisterBiodiversityProjectInput {
  readonly projectId: Bytes32;
  readonly steward: Address;
  readonly habitat: Bytes32;
  readonly geohash: Bytes32;
  readonly methodology: Bytes32;
  readonly areaHectares: number;
}

export interface CreateGreenBondInput {
  readonly bondId: Bytes32;
  readonly token: Address;
  readonly principalTarget: bigint;
  readonly couponBps: number;
  readonly tenorDays: number;
  readonly couponPeriods: number;
  readonly greenCategory: Bytes32;
}
