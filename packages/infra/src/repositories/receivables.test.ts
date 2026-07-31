import { describe, it, expect } from "vitest";
import { createReceivablesRepository } from "./receivables.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ receivables: [] });
  return { fake, repo: createReceivablesRepository(fake.client as never) };
}

describe("ReceivablesRepository", () => {
  it("upserts with defaults and normalizes nullable numerics to strings", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({
      batchId: B32("a"),
      holder: ADDR("1"),
      faceValue: "1000000",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.status).toBe("registered");
      expect(res.data.faceValue).toBe("1000000");
      expect(res.data.tokenId).toBeNull();
    }
  });

  it("filters by holder, obligor and status", async () => {
    const { repo: r } = repo();
    await r.upsert({ batchId: B32("a"), holder: ADDR("1"), obligor: ADDR("9"), status: "financed" });
    await r.upsert({ batchId: B32("b"), holder: ADDR("1"), obligor: ADDR("8"), status: "registered" });
    await r.upsert({ batchId: B32("c"), holder: ADDR("2"), obligor: ADDR("9"), status: "financed" });

    const byHolder = await r.findByHolder(ADDR("1"));
    if (isOk(byHolder)) expect(byHolder.data).toHaveLength(2);
    const byObligor = await r.findByObligor(ADDR("9"));
    if (isOk(byObligor)) expect(byObligor.data).toHaveLength(2);
    const financed = await r.findByStatus("financed");
    if (isOk(financed)) expect(financed.data.map((x) => x.batchId).sort()).toEqual([B32("a"), B32("c")]);
  });

  it("rejects a malformed batch id", async () => {
    const { fake, repo: r } = repo();
    const res = await r.upsert({ batchId: "0xshort" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("receivables")).toHaveLength(0);
  });
});
