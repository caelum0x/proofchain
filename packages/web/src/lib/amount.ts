import { parseUnits } from "viem";

export interface ParsedAmount {
  readonly value: bigint | null;
  readonly error: string | null;
}

/**
 * Parse a decimal user-input amount into token base units, rejecting values with
 * more fractional digits than the token supports (which parseUnits would
 * silently truncate).
 */
export function parseTokenInput(input: string, decimals: number): ParsedAmount {
  const trimmed = input.trim();
  if (trimmed === "") return { value: null, error: "Amount is required" };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { value: null, error: "Enter a positive number" };
  }
  const [, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    return { value: null, error: `Max ${decimals} decimal places` };
  }
  try {
    const value = parseUnits(trimmed, decimals);
    if (value <= 0n) return { value: null, error: "Amount must be greater than zero" };
    return { value, error: null };
  } catch {
    return { value: null, error: "Invalid amount" };
  }
}
