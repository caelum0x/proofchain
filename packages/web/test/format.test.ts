import { describe, expect, it } from "vitest";
import {
  dealStateLabel,
  dealStateTone,
  explorerTxUrl,
  formatBps,
  formatTimestamp,
  formatTokenAmount,
  ipfsToHttp,
  severityTone,
  shortenHex,
} from "@/lib/format";
import { DealState } from "@/lib/types";

describe("shortenHex", () => {
  it("keeps short values intact", () => {
    expect(shortenHex("0x1234")).toBe("0x1234");
  });
  it("truncates long values", () => {
    expect(shortenHex("0x1234567890abcdef1234")).toBe("0x1234…1234");
  });
  it("returns empty string for empty input", () => {
    expect(shortenHex("")).toBe("");
  });
});

describe("formatBps", () => {
  it("converts bps to percent", () => {
    expect(formatBps(9600)).toBe("96.00%");
    expect(formatBps(0)).toBe("0.00%");
    expect(formatBps(10000)).toBe("100.00%");
  });
  it("clamps out-of-range values", () => {
    expect(formatBps(20000)).toBe("100.00%");
    expect(formatBps(-5)).toBe("0.00%");
  });
});

describe("formatTokenAmount", () => {
  it("formats whole amounts", () => {
    expect(formatTokenAmount(1_000_000n, 6)).toBe("1");
  });
  it("formats fractional amounts and trims zeros", () => {
    expect(formatTokenAmount(1_500_000n, 6)).toBe("1.5");
    expect(formatTokenAmount(1_234_560n, 6)).toBe("1.23456");
  });
  it("handles zero", () => {
    expect(formatTokenAmount(0n, 6)).toBe("0");
  });
  it("handles negative", () => {
    expect(formatTokenAmount(-1_500_000n, 6)).toBe("-1.5");
  });
  it("respects maxFractionDigits", () => {
    expect(formatTokenAmount(1_234_567n, 6, 2)).toBe("1.23");
  });
  it("throws on negative decimals", () => {
    expect(() => formatTokenAmount(1n, -1)).toThrow(RangeError);
  });
});

describe("dealStateLabel / tone", () => {
  it("labels each state", () => {
    expect(dealStateLabel(DealState.Funded)).toBe("Funded");
    expect(dealStateLabel(DealState.Released)).toBe("Released");
    expect(dealStateLabel(DealState.Disputed)).toBe("Disputed");
  });
  it("maps tone", () => {
    expect(dealStateTone(DealState.Released)).toBe("success");
    expect(dealStateTone(DealState.Disputed)).toBe("danger");
    expect(dealStateTone(DealState.None)).toBe("neutral");
  });
});

describe("severityTone", () => {
  it("maps severities to tones", () => {
    expect(severityTone("critical")).toBe("danger");
    expect(severityTone("high")).toBe("danger");
    expect(severityTone("medium")).toBe("warn");
    expect(severityTone("low")).toBe("brand");
    expect(severityTone("info")).toBe("neutral");
  });
});

describe("ipfsToHttp", () => {
  it("rewrites ipfs uris", () => {
    expect(ipfsToHttp("ipfs://Qm123")).toBe("https://ipfs.io/ipfs/Qm123");
  });
  it("passes through http uris", () => {
    expect(ipfsToHttp("https://x.test/v")).toBe("https://x.test/v");
  });
});

describe("explorerTxUrl", () => {
  it("builds a basescan url", () => {
    expect(explorerTxUrl("0xabc")).toBe("https://sepolia.basescan.org/tx/0xabc");
  });
});

describe("formatTimestamp", () => {
  it("returns dash for invalid", () => {
    expect(formatTimestamp(0)).toBe("—");
    expect(formatTimestamp(-1)).toBe("—");
  });
  it("formats valid timestamps", () => {
    expect(formatTimestamp(1_700_000_000)).not.toBe("—");
  });
});
