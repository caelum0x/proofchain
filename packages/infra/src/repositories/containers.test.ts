import { describe, it, expect } from "vitest";
import { createContainersRepository } from "./containers.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;

function seededRepo() {
  const fake = createFakeSupabase({ containers: [] });
  return { fake, repo: createContainersRepository(fake.client as never) };
}

describe("ContainersRepository", () => {
  it("upserts and reads back a container", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "con-1",
      containerNumber: "MSKU1234567",
      freightId: "frt-1",
      batchId: B32("a"),
      status: "loaded",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.containerNumber).toBe("MSKU1234567");

    const byNumber = await repo.findByNumber("MSKU1234567");
    if (isOk(byNumber)) expect(byNumber.data?.id).toBe("con-1");
  });

  it("filters by freight and status", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "con-1", freightId: "frt-1", status: "loaded" });
    await repo.upsert({ id: "con-2", freightId: "frt-1", status: "sealed" });
    await repo.upsert({ id: "con-3", freightId: "frt-2", status: "loaded" });

    const byFreight = await repo.findByFreight("frt-1");
    if (isOk(byFreight)) expect(byFreight.data).toHaveLength(2);

    const loaded = await repo.findByStatus("loaded");
    if (isOk(loaded)) expect(loaded.data.map((c) => c.id).sort()).toEqual(["con-1", "con-3"]);
  });

  it("rejects an invalid status", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "con-x", status: "floating" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("containers")).toHaveLength(0);
  });
});
