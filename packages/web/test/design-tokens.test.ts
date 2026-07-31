import { describe, expect, it } from "vitest";
import { darkPalette, lightPalette, domainAccents, paletteToCssVars, radius } from "@/design/tokens";
import {
  SIDEBAR_GROUPS,
  ALL_SIDEBAR_ITEMS,
  activeSidebar,
  isMarketingRoute,
  ACCENT_TEXT,
  ACCENT_VAR,
} from "@/lib/sidebar-nav";

describe("design tokens", () => {
  it("exposes matching keys for dark and light palettes", () => {
    expect(Object.keys(darkPalette).sort()).toEqual(Object.keys(lightPalette).sort());
  });

  it("stores colors as RGB channel triplets", () => {
    for (const value of Object.values(darkPalette)) {
      expect(value).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
  });

  it("builds CSS variable declarations including domain accents", () => {
    const vars = paletteToCssVars(darkPalette);
    expect(vars["--bg"]).toBe(darkPalette.bg);
    expect(vars["--accent-finance"]).toBe(domainAccents.finance);
  });

  it("defines the WD radius scale", () => {
    expect(radius.sm).toBe("6px");
    expect(radius.pill).toBe("9999px");
  });
});

describe("sidebar navigation", () => {
  it("covers every WD §5 section", () => {
    const labels = SIDEBAR_GROUPS.map((g) => g.label);
    for (const section of [
      "Overview",
      "Provenance",
      "Settlement",
      "Trade Finance",
      "Insurance",
      "Compliance",
      "Logistics",
      "Sustainability",
      "Workforce",
      "Markets",
      "Identity",
      "Governance",
      "Rewards",
      "System",
    ]) {
      expect(labels).toContain(section);
    }
  });

  it("has an accent class + var for every group accent", () => {
    for (const group of SIDEBAR_GROUPS) {
      expect(ACCENT_TEXT[group.accent]).toBeTruthy();
      expect(ACCENT_VAR[group.accent]).toBeTruthy();
    }
  });

  it("wires unique, absolute routes", () => {
    for (const item of ALL_SIDEBAR_ITEMS) {
      expect(item.href.startsWith("/")).toBe(true);
    }
    expect(ALL_SIDEBAR_ITEMS.length).toBeGreaterThan(60);
  });

  it("resolves the active group + item by longest match", () => {
    const { group, item } = activeSidebar("/finance/pools");
    expect(group?.label).toBe("Trade Finance");
    expect(item?.href).toBe("/finance/pools");
  });

  it("classifies marketing vs app routes", () => {
    expect(isMarketingRoute("/")).toBe(true);
    expect(isMarketingRoute("/docs")).toBe(true);
    expect(isMarketingRoute("/onboarding")).toBe(true);
    expect(isMarketingRoute("/dashboard")).toBe(false);
    expect(isMarketingRoute("/batches")).toBe(false);
  });
});
