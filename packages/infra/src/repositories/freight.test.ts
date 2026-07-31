import { describe, it, expect } from "vitest";
import { createFreightRepository } from "./freight.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ freight: [] });
  return { fake, repo: createFreightRepository(fake.client as never) };
}

describe("FreightRepository", () => {
  it("upserts and reads back a freight booking", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "frt-1",
      batchId: B32("a"),
      carrier: ADDR("2"),
      origin: "Rotterdam",
      destination: "Singapore",
      status: "booked",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.destination).toBe("Singapore");

    const found = await repo.findById("frt-1");
    if (isOk(found)) expect(found.data?.status).toBe("booked");
  });

  it("filters by batch, carrier and status", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "frt-1", batchId: B32("a"), carrier: ADDR("2"), status: "booked" });
    await repo.upsert({ id: "frt-2", batchId: B32("a"), carrier: ADDR("3"), status: "in_transit" });
    await repo.upsert({ id: "frt-3", batchId: B32("b"), carrier: ADDR("2"), status: "in_transit" });

    const byBatch = await repo.findByBatch(B32("a"));
    if (isOk(byBatch)) expect(byBatch.data).toHaveLength(2);

    const byCarrier = await repo.findByCarrier(ADDR("2"));
    if (isOk(byCarrier)) expect(byCarrier.data).toHaveLength(2);

    const transit = await repo.findByStatus("in_transit");
    if (isOk(transit)) expect(transit.data.map((f) => f.id).sort()).toEqual(["frt-2", "frt-3"]);
  });

  it("rejects an invalid status", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "frt-x", status: "lost" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("freight")).toHaveLength(0);
  });
});
