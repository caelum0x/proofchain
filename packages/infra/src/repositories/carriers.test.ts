import { describe, it, expect } from "vitest";
import { createCarriersRepository } from "./carriers.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ carriers: [] });
  return { fake, repo: createCarriersRepository(fake.client as never) };
}

describe("CarriersRepository", () => {
  it("upserts and reads back a carrier", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ address: ADDR("1"), name: "Maersk", orgId: "org-3" });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.name).toBe("Maersk");
  });

  it("filters by organization", async () => {
    const { repo: r } = repo();
    await r.upsert({ address: ADDR("1"), orgId: "org-3" });
    await r.upsert({ address: ADDR("2"), orgId: "org-3" });
    await r.upsert({ address: ADDR("3"), orgId: "org-4" });
    const byOrg = await r.findByOrg("org-3");
    if (isOk(byOrg)) expect(byOrg.data).toHaveLength(2);
  });

  it("rejects a malformed address", async () => {
    const { fake, repo: r } = repo();
    const res = await r.upsert({ address: "0x123" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("carriers")).toHaveLength(0);
  });
});
