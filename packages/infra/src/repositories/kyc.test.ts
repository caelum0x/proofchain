import { describe, it, expect } from "vitest";
import { createKycRepository } from "./kyc.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ kyc: [] });
  return { fake, repo: createKycRepository(fake.client as never) };
}

describe("KycRepository", () => {
  it("defaults level to 0 when omitted", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ address: ADDR("1") });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.level).toBe(0);
  });

  it("filters by minimum level and by provider", async () => {
    const { repo: r } = repo();
    await r.upsert({ address: ADDR("1"), level: 1, provider: ADDR("f") });
    await r.upsert({ address: ADDR("2"), level: 3, provider: ADDR("f") });
    await r.upsert({ address: ADDR("3"), level: 0, provider: ADDR("e") });

    const tier2 = await r.findByMinLevel(2);
    if (isOk(tier2)) expect(tier2.data.map((k) => k.address)).toEqual([ADDR("2")]);

    const byProvider = await r.findByProvider(ADDR("f"));
    if (isOk(byProvider)) expect(byProvider.data).toHaveLength(2);
  });

  it("rejects a negative level", async () => {
    const { fake, repo: r } = repo();
    const res = await r.upsert({ address: ADDR("1"), level: -1 } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("kyc")).toHaveLength(0);
  });
});
