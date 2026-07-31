import { describe, it, expect } from "vitest";
import { createSuppliersRepository } from "./suppliers.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ suppliers: [] });
  return { fake, repo: createSuppliersRepository(fake.client as never) };
}

describe("SuppliersRepository", () => {
  it("upserts and reads back a supplier", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ address: ADDR("1"), name: "Farm Co", orgId: "org-1" });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.name).toBe("Farm Co");
    const found = await r.findById(ADDR("1"));
    if (isOk(found)) expect(found.data?.orgId).toBe("org-1");
  });

  it("filters by organization", async () => {
    const { repo: r } = repo();
    await r.upsert({ address: ADDR("1"), orgId: "org-1" });
    await r.upsert({ address: ADDR("2"), orgId: "org-1" });
    await r.upsert({ address: ADDR("3"), orgId: "org-2" });
    const byOrg = await r.findByOrg("org-1");
    if (isOk(byOrg)) expect(byOrg.data).toHaveLength(2);
  });

  it("rejects a malformed address before hitting the DB", async () => {
    const { fake, repo: r } = repo();
    const res = await r.upsert({ address: "0xnope" } as never);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
    expect(fake.tables.get("suppliers")).toHaveLength(0);
  });
});
