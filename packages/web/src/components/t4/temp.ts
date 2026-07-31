import type { SemanticStatus } from "@/components/ui/StatusBadge";

/**
 * Cold-chain temperature helpers. The `CheckpointOracle` stores temperature as
 * an `int256` in centidegrees Celsius (×100) so IoT keepers can report sub-degree
 * precision without floats. The UI converts to/from human °C at the boundary.
 */

/** Default safe cold-chain window (°C) — pharma/perishable convention. */
export const DEFAULT_TEMP_MIN_C = 2;
export const DEFAULT_TEMP_MAX_C = 8;

/** Raw on-chain centidegrees → °C. */
export function toCelsius(raw: bigint | number): number {
  return Number(raw) / 100;
}

/** Human °C → on-chain centidegrees (int256). */
export function toCentidegrees(celsius: number): bigint {
  return BigInt(Math.round(celsius * 100));
}

export function formatCelsius(raw: bigint | number, digits = 1): string {
  return `${toCelsius(raw).toFixed(digits)}°C`;
}

export interface TempWindow {
  readonly minC: number;
  readonly maxC: number;
}

export function isBreach(raw: bigint | number, window: TempWindow): boolean {
  const c = toCelsius(raw);
  return c < window.minC || c > window.maxC;
}

/** Semantic tone for a reading relative to the safe window (warn near edges). */
export function tempTone(raw: bigint | number, window: TempWindow): SemanticStatus {
  const c = toCelsius(raw);
  if (c < window.minC || c > window.maxC) return "danger";
  const margin = (window.maxC - window.minC) * 0.15;
  if (c <= window.minC + margin || c >= window.maxC - margin) return "warn";
  return "success";
}
