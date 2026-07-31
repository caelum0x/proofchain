import { describe, it, expect } from "vitest";
import { createSensorsRepository } from "./sensors.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;

function seededRepo() {
  const fake = createFakeSupabase({ sensors: [] });
  return { fake, repo: createSensorsRepository(fake.client as never) };
}

describe("SensorsRepository", () => {
  it("upserts and reads back a sensor", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "sen-1",
      deviceId: "dev-42",
      batchId: B32("a"),
      sensorType: "temperature",
      lastReading: 4.5,
      unit: "C",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.lastReading).toBe(4.5);

    const byDevice = await repo.findByDevice("dev-42");
    if (isOk(byDevice)) expect(byDevice.data?.id).toBe("sen-1");
  });

  it("filters by batch and status", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "sen-1", deviceId: "d1", batchId: B32("a"), status: "active" });
    await repo.upsert({ id: "sen-2", deviceId: "d2", batchId: B32("a"), status: "faulty" });
    await repo.upsert({ id: "sen-3", deviceId: "d3", batchId: B32("b"), status: "active" });

    const byBatch = await repo.findByBatch(B32("a"));
    if (isOk(byBatch)) expect(byBatch.data).toHaveLength(2);

    const faulty = await repo.findByStatus("faulty");
    if (isOk(faulty)) expect(faulty.data.map((s) => s.id)).toEqual(["sen-2"]);
  });

  it("rejects a sensor with no device id", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "sen-x", deviceId: "" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("sensors")).toHaveLength(0);
  });
});
