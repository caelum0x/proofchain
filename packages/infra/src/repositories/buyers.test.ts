import { describe, it, expect } from "vitest";
import { createBuyersRepository } from "./buyers.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ buyers: [] });
  return { fake, repo: createBuyersRepository(fake.client as never) };
}

describe("BuyersRepository", () => {
  it("upserts and reads back a buyer", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ address: ADDR("1"), name: "Importer", orgId: "org-9" });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.name).toBe("Importer");
    const found = await r.findById(ADDR("1"));
    if (isOk(found)) expect(found.data?.orgId).toBe("org-9");
  });

  it("filters by organization", async () => {
    const { repo: r } = repo();
    await r.upsert({ address: ADDR("1"), orgId: "org-9" });
    await r.upsert({ address: ADDR("2"), orgId: "org-8" });
    const byOrg = await r.findByOrg("org-9");
    if (isOk(byOrg)) expect(byOrg.data).toHaveLength(1);
  });

  it("rejects a malformed address", async () => {
    const { fake, repo: r } = repo();
    const res = await r.upsert({ address: "bad" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("buyers")).toHaveLength(0);
  });
});
