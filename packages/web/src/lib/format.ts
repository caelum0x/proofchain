import type { Address, Hex } from "viem";
import { DealState, type DealStateValue } from "./types";
import type { Finding } from "./shared";

export const BASESCAN_URL = "https://sepolia.basescan.org";

export function explorerTxUrl(hash: Hex | string): string {
  return `${BASESCAN_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: Address | string): string {
  return `${BASESCAN_URL}/address/${address}`;
}

/** Shorten a hex string / address for display: 0x1234…abcd. */
export function shortenHex(value: string, lead = 4, tail = 4): string {
  if (!value) return "";
  if (value.length <= lead + tail + 2) return value;
  return `${value.slice(0, lead + 2)}…${value.slice(-tail)}`;
}

/** Format a basis-points score (0..10000) as a percentage string. */
export function formatBps(score: number): string {
  const clamped = Math.max(0, Math.min(10000, score));
  return `${(clamped / 100).toFixed(2)}%`;
}

/**
 * Format a base-unit token amount as a human-readable decimal string.
 * Avoids floating point by operating on the bigint directly.
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  maxFractionDigits = 6,
): string {
  if (decimals < 0) throw new RangeError("decimals must be >= 0");
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;

  let fractionStr = "";
  if (decimals > 0 && fraction > 0n) {
    fractionStr = fraction.toString().padStart(decimals, "0");
    if (maxFractionDigits < decimals) {
      fractionStr = fractionStr.slice(0, maxFractionDigits);
    }
    fractionStr = fractionStr.replace(/0+$/, "");
  }

  const wholeStr = whole.toString();
  const sign = negative ? "-" : "";
  return fractionStr ? `${sign}${wholeStr}.${fractionStr}` : `${sign}${wholeStr}`;
}

const DEAL_STATE_LABELS: Record<DealStateValue, string> = {
  [DealState.None]: "No deal",
  [DealState.Funded]: "Funded",
  [DealState.Released]: "Released",
  [DealState.Refunded]: "Refunded",
  [DealState.Disputed]: "Disputed",
};

export function dealStateLabel(state: DealStateValue): string {
  return DEAL_STATE_LABELS[state] ?? "Unknown";
}

export type ToneName = "neutral" | "brand" | "success" | "warn" | "danger";

export function dealStateTone(state: DealStateValue): ToneName {
  switch (state) {
    case DealState.Funded:
      return "brand";
    case DealState.Released:
      return "success";
    case DealState.Disputed:
      return "danger";
    case DealState.Refunded:
      return "warn";
    default:
      return "neutral";
  }
}

export function severityTone(severity: Finding["severity"]): ToneName {
  switch (severity) {
    case "critical":
    case "high":
      return "danger";
    case "medium":
      return "warn";
    case "low":
      return "brand";
    case "info":
    default:
      return "neutral";
  }
}

/** Format a unix-seconds timestamp as a locale date-time. */
export function formatTimestamp(unixSeconds: number): string {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return "—";
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Convert an ipfs:// URI to an HTTP gateway URL for fetching. */
export function ipfsToHttp(
  uri: string,
  gateway = "https://ipfs.io/ipfs/",
): string {
  if (uri.startsWith("ipfs://")) {
    return gateway + uri.slice("ipfs://".length).replace(/^ipfs\//, "");
  }
  return uri;
}
