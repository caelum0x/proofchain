import { describe, it, expect } from "vitest";
import { z } from "zod";
import { BaseRepository, type RepositoryConfig } from "./base.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

interface Widget {
  id: string;
  name: string;
  qty: number;
}

const config: RepositoryConfig<Widget, Widget> = {
  table: "widgets",
  primaryKey: "id",
  entitySchema: z.object({ id: z.string(), name: z.string(), qty: z.number() }),
  insertSchema: z.object({ id: z.string(), name: z.string(), qty: z.number().int().min(0) }),
  toRow: (w) => ({ id: w.id, name: w.name, qty: w.qty }),
  fromRow: (r) => ({ id: r.id, name: r.name, qty: Number(r.qty) }),
};

describe("BaseRepository — no-op path (null client)", () => {
  const repo = new BaseRepository<Widget, Widget>(null, config);

  it("reports not configured", () => {
    expect(repo.isConfigured).toBe(false);
    expect(repo.table).toBe("widgets");
  });

  it("reads resolve empty, writes resolve NOT_CONFIGURED", async () => {
    expect((await repo.findById("x")).data).toBeNull();
    expect((await repo.find()).data).toEqual([]);
    expect((await repo.count()).data).toBe(0);

    const created = await repo.create({ id: "a", name: "A", qty: 1 });
    expect(isErr(created)).toBe(true);
    if (isErr(created)) expect(created.error.code).toBe("INFRA_NOT_CONFIGURED");

    const deleted = await repo.delete("a");
    expect(isErr(deleted)).toBe(true);
  });
});

describe("BaseRepository — live path (fake client)", () => {
  it("performs full CRUD + query", async () => {
    const fake = createFakeSupabase({ widgets: [] });
    const repo = new BaseRepository<Widget, Widget>(fake.client as never, config);
    expect(repo.isConfigured).toBe(true);

    const created = await repo.create({ id: "w1", name: "Alpha", qty: 5 });
    expect(isOk(created)).toBe(true);
    if (isOk(created)) expect(created.data.qty).toBe(5);

    await repo.create({ id: "w2", name: "Beta", qty: 1 });

    const found = await repo.findById("w1");
    expect(isOk(found)).toBe(true);
    if (isOk(found)) expect(found.data?.name).toBe("Alpha");

    const filtered = await repo.find({
      filters: [{ column: "qty", op: "gte", value: 3 }],
    });
    expect(isOk(filtered)).toBe(true);
    if (isOk(filtered)) expect(filtered.data.map((w) => w.id)).toEqual(["w1"]);

    const total = await repo.count();
    if (isOk(total)) expect(total.data).toBe(2);

    const updated = await repo.update("w2", { qty: 9 });
    expect(isOk(updated)).toBe(true);
    if (isOk(updated)) expect(updated.data.qty).toBe(9);

    const removed = await repo.delete("w1");
    expect(isOk(removed)).toBe(true);
    const gone = await repo.findById("w1");
    if (isOk(gone)) expect(gone.data).toBeNull();
  });

  it("rejects invalid input before touching the DB", async () => {
    const fake = createFakeSupabase({ widgets: [] });
    const repo = new BaseRepository<Widget, Widget>(fake.client as never, config);
    const res = await repo.create({ id: "bad", name: "x", qty: -1 });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
    expect(fake.tables.get("widgets")).toHaveLength(0);
  });

  it("rejects an empty update patch", async () => {
    const fake = createFakeSupabase({ widgets: [{ id: "w1", name: "A", qty: 1 }] });
    const repo = new BaseRepository<Widget, Widget>(fake.client as never, config);
    const res = await repo.update("w1", {});
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
  });

  it("flags a corrupt row as a validation error on read", async () => {
    const fake = createFakeSupabase({ widgets: [{ id: "w1", name: 123, qty: "nope" }] });
    const repo = new BaseRepository<Widget, Widget>(fake.client as never, config);
    const res = await repo.findById("w1");
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
  });
});
