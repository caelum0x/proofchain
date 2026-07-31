import { describe, it, expect } from "vitest";
import { createPayrollRepository } from "./payroll.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ payroll: [] });
  return { fake, repo: createPayrollRepository(fake.client as never) };
}

describe("PayrollRepository", () => {
  it("upserts and reads back a payroll entry", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "pay-1",
      worker: ADDR("1"),
      employer: ADDR("2"),
      token: ADDR("3"),
      amount: "500000",
      milestone: "delivery",
      status: "pending",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.amount).toBe("500000");

    const found = await repo.findById("pay-1");
    if (isOk(found)) expect(found.data?.milestone).toBe("delivery");
  });

  it("filters by worker, employer and status", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "pay-1", worker: ADDR("1"), employer: ADDR("2"), status: "pending" });
    await repo.upsert({ id: "pay-2", worker: ADDR("1"), employer: ADDR("2"), status: "paid" });
    await repo.upsert({ id: "pay-3", worker: ADDR("9"), employer: ADDR("2"), status: "pending" });

    const byWorker = await repo.findByWorker(ADDR("1"));
    if (isOk(byWorker)) expect(byWorker.data).toHaveLength(2);

    const byEmployer = await repo.findByEmployer(ADDR("2"));
    if (isOk(byEmployer)) expect(byEmployer.data).toHaveLength(3);

    const pending = await repo.findByStatus("pending");
    if (isOk(pending)) expect(pending.data.map((p) => p.id).sort()).toEqual(["pay-1", "pay-3"]);
  });

  it("rejects a malformed worker address", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "pay-x", worker: "0xnope" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("payroll")).toHaveLength(0);
  });
});
