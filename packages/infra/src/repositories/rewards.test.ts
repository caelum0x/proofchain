import { describe, it, expect } from "vitest";
import { createRewardsRepository } from "./rewards.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ rewards: [] });
  return { fake, repo: createRewardsRepository(fake.client as never) };
}

describe("RewardsRepository", () => {
  it("upserts and reads back a reward accrual", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "rew-1",
      account: ADDR("1"),
      program: "loyalty",
      amount: "1000",
      claimed: "250",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.amount).toBe("1000");

    const found = await repo.findById("rew-1");
    if (isOk(found)) expect(found.data?.program).toBe("loyalty");
  });

  it("filters by account and program", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "rew-1", account: ADDR("1"), program: "loyalty" });
    await repo.upsert({ id: "rew-2", account: ADDR("1"), program: "referral" });
    await repo.upsert({ id: "rew-3", account: ADDR("9"), program: "loyalty" });

    const byAccount = await repo.findByAccount(ADDR("1"));
    if (isOk(byAccount)) expect(byAccount.data).toHaveLength(2);

    const loyalty = await repo.findByProgram("loyalty");
    if (isOk(loyalty)) expect(loyalty.data.map((r) => r.id).sort()).toEqual(["rew-1", "rew-3"]);
  });

  it("rejects a malformed account address", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "rew-x", account: "0xnope" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("rewards")).toHaveLength(0);
  });
});
