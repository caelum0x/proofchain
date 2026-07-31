import { describe, expect, it } from "vitest";
import { NAV_GROUPS, ALL_NAV_ITEMS, activeNav } from "@/lib/nav";

/** Every section SPEC2 "Web" requires the shared nav to cover. */
const REQUIRED_ROUTES = [
  "/explorer",
  "/suppliers",
  "/buyers",
  "/carriers",
  "/organizations",
  "/leaderboard",
  "/reputation",
  "/dashboard",
  "/finance",
  "/finance/pools",
  "/finance/lend",
  "/invoices",
  "/insurance",
  "/insurance/claims",
  "/disputes",
  "/governance",
  "/nft",
  "/esg",
  "/carbon",
  "/marketplace",
  "/marketplace/auctions",
  "/rewards",
  "/referrals",
  "/admin",
  // existing flows
  "/supplier",
  "/buyer",
  "/verifier",
];

describe("site navigation", () => {
  const hrefs = new Set(ALL_NAV_ITEMS.map((i) => i.href));

  it("covers every required platform section", () => {
    for (const route of REQUIRED_ROUTES) {
      expect(hrefs.has(route), `missing nav route: ${route}`).toBe(true);
    }
  });

  it("has no duplicate routes", () => {
    expect(hrefs.size).toBe(ALL_NAV_ITEMS.length);
  });

  it("every group has at least one item", () => {
    for (const group of NAV_GROUPS) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });
});

describe("activeNav", () => {
  it("matches an exact route", () => {
    expect(activeNav("/carbon").item?.href).toBe("/carbon");
  });

  it("matches a nested route", () => {
    expect(activeNav("/suppliers/0xabc").item?.href).toBe("/suppliers");
  });

  it("prefers the longest match", () => {
    expect(activeNav("/finance/pools/7").item?.href).toBe("/finance/pools");
  });

  it("returns empty for an unknown route", () => {
    expect(activeNav("/nowhere").item).toBeUndefined();
  });
});
