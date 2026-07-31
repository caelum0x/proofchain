import type { ToneName } from "@/lib/format";

/**
 * Human labels + tones for `OrganizationRegistry.OrgType`. Mirrors
 * `ORG_TYPE_LABELS` / `OrgType` in `@proofchain/shared` (kept local so the
 * component layer carries no runtime dependency on the shared package).
 */
export const ORG_TYPE_LABELS: Readonly<Record<number, string>> = Object.freeze({
  0: "Unknown",
  1: "Supplier",
  2: "Buyer",
  3: "Carrier",
  4: "Lender",
  5: "Insurer",
  6: "Other",
});

export function orgTypeLabel(orgType: number): string {
  return ORG_TYPE_LABELS[orgType] ?? "Unknown";
}

export function orgTypeTone(orgType: number): ToneName {
  switch (orgType) {
    case 1: // Supplier
      return "brand";
    case 2: // Buyer
      return "success";
    case 3: // Carrier
      return "warn";
    case 4: // Lender
    case 5: // Insurer
      return "neutral";
    default:
      return "neutral";
  }
}
