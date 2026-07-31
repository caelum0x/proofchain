import { describe, it, expect } from "vitest";
import { createAttestationsRepository } from "./attestations.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ attestations: [] });
  return { fake, repo: createAttestationsRepository(fake.client as never) };
}

describe("AttestationsRepository", () => {
  it("creates an attestation with default threshold/version", async () => {
    const { repo: r } = repo();
    const res = await r.create({
      id: `${B32("a")}:1`,
      batchId: B32("a"),
      attester: ADDR("1"),
      score: 9200,
      passed: true,
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.version).toBe(1);
      expect(res.data.threshold).toBe(0);
      expect(res.data.passed).toBe(true);
    }
  });

  it("finds by batch, by passed and returns the latest version", async () => {
    const { repo: r } = repo();
    await r.create({ id: `${B32("a")}:1`, batchId: B32("a"), score: 6000, passed: false, version: 1 });
    await r.create({ id: `${B32("a")}:2`, batchId: B32("a"), score: 9000, passed: true, version: 2 });
    await r.create({ id: `${B32("b")}:1`, batchId: B32("b"), score: 8000, passed: true, version: 1 });

    const byBatch = await r.findByBatch(B32("a"));
    if (isOk(byBatch)) expect(byBatch.data.map((x) => x.version)).toEqual([2, 1]);

    const passing = await r.findByPassed(true);
    if (isOk(passing)) expect(passing.data).toHaveLength(2);

    const latest = await r.latestForBatch(B32("a"));
    if (isOk(latest)) expect(latest.data?.version).toBe(2);

    const none = await r.latestForBatch(B32("c"));
    if (isOk(none)) expect(none.data).toBeNull();
  });

  it("rejects an out-of-range score", async () => {
    const { fake, repo: r } = repo();
    const res = await r.create({ id: "x", batchId: B32("a"), score: 99999, passed: true } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("attestations")).toHaveLength(0);
  });
});
