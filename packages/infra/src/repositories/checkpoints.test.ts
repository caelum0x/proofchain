import { describe, it, expect } from "vitest";
import { createCheckpointsRepository } from "./checkpoints.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ checkpoints: [] });
  return { fake, repo: createCheckpointsRepository(fake.client as never) };
}

describe("CheckpointsRepository", () => {
  it("creates a checkpoint with default kind/sequence", async () => {
    const { repo: r } = repo();
    const res = await r.create({ id: `${B32("a")}:0`, batchId: B32("a"), actor: ADDR("1") });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.kind).toBe("checkpoint");
      expect(res.data.sequence).toBe(0);
    }
  });

  it("returns the batch trail ordered by sequence", async () => {
    const { repo: r } = repo();
    await r.create({ id: `${B32("a")}:2`, batchId: B32("a"), sequence: 2, kind: "delivery" });
    await r.create({ id: `${B32("a")}:0`, batchId: B32("a"), sequence: 0, kind: "origin" });
    await r.create({ id: `${B32("a")}:1`, batchId: B32("a"), sequence: 1, kind: "customs" });
    await r.create({ id: `${B32("b")}:0`, batchId: B32("b"), sequence: 0, kind: "origin" });

    const trail = await r.findByBatch(B32("a"));
    if (isOk(trail)) expect(trail.data.map((c) => c.sequence)).toEqual([0, 1, 2]);

    const customs = await r.findByKind("customs");
    if (isOk(customs)) expect(customs.data).toHaveLength(1);
  });

  it("rejects a malformed actor address", async () => {
    const { fake, repo: r } = repo();
    const res = await r.create({ id: "x", batchId: B32("a"), actor: "0xbad" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("checkpoints")).toHaveLength(0);
  });
});
