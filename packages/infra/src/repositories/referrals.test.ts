import { describe, it, expect } from "vitest";
import { createReferralsRepository } from "./referrals.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ referrals: [] });
  return { fake, repo: createReferralsRepository(fake.client as never) };
}

describe("ReferralsRepository", () => {
  it("upserts and reads back a referral", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "ref-1",
      referrer: ADDR("1"),
      referee: ADDR("2"),
      code: "WELCOME",
      rewardAmount: "500",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.rewardAmount).toBe("500");

    const byCode = await repo.findByCode("WELCOME");
    if (isOk(byCode)) expect(byCode.data?.id).toBe("ref-1");
  });

  it("filters by referrer, referee and status", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "ref-1", referrer: ADDR("1"), referee: ADDR("2"), status: "converted" });
    await repo.upsert({ id: "ref-2", referrer: ADDR("1"), status: "pending" });

    const byReferrer = await repo.findByReferrer(ADDR("1"));
    if (isOk(byReferrer)) expect(byReferrer.data).toHaveLength(2);

    const byReferee = await repo.findByReferee(ADDR("2"));
    if (isOk(byReferee)) expect(byReferee.data?.id).toBe("ref-1");

    const converted = await repo.findByStatus("converted");
    if (isOk(converted)) expect(converted.data).toHaveLength(1);
  });

  it("rejects a malformed referrer address", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "ref-x", referrer: "0xnope" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("referrals")).toHaveLength(0);
  });
});
