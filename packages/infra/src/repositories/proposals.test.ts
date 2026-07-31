import { describe, it, expect } from "vitest";
import { createProposalsRepository } from "./proposals.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ proposals: [] });
  return { fake, repo: createProposalsRepository(fake.client as never) };
}

describe("ProposalsRepository", () => {
  it("upserts and reads back a proposal", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "prop-1",
      proposer: ADDR("1"),
      state: "active",
      forVotes: "100",
      againstVotes: "20",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.forVotes).toBe("100");

    const found = await repo.findById("prop-1");
    if (isOk(found)) expect(found.data?.state).toBe("active");
  });

  it("filters by state and proposer", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "prop-1", proposer: ADDR("1"), state: "active" });
    await repo.upsert({ id: "prop-2", proposer: ADDR("1"), state: "executed" });
    await repo.upsert({ id: "prop-3", proposer: ADDR("9"), state: "active" });

    const active = await repo.findByState("active");
    if (isOk(active)) expect(active.data.map((p) => p.id).sort()).toEqual(["prop-1", "prop-3"]);

    const byProposer = await repo.findByProposer(ADDR("1"));
    if (isOk(byProposer)) expect(byProposer.data).toHaveLength(2);
  });

  it("rejects a non-numeric vote tally", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "prop-x", forVotes: "ten" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("proposals")).toHaveLength(0);
  });
});
