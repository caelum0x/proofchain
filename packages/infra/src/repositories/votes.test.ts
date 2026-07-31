import { describe, it, expect } from "vitest";
import { createVotesRepository } from "./votes.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ votes: [] });
  return { fake, repo: createVotesRepository(fake.client as never) };
}

describe("VotesRepository", () => {
  it("records and reads back a vote", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: `prop-1:${ADDR("1")}`,
      proposalId: "prop-1",
      voter: ADDR("1"),
      support: 1,
      weight: "500",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.support).toBe(1);
  });

  it("filters by proposal and voter", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "prop-1:a", proposalId: "prop-1", voter: ADDR("1"), support: 1 });
    await repo.upsert({ id: "prop-1:b", proposalId: "prop-1", voter: ADDR("2"), support: 0 });
    await repo.upsert({ id: "prop-2:a", proposalId: "prop-2", voter: ADDR("1"), support: 2 });

    const byProposal = await repo.findByProposal("prop-1");
    if (isOk(byProposal)) expect(byProposal.data).toHaveLength(2);

    const byVoter = await repo.findByVoter(ADDR("1"));
    if (isOk(byVoter)) expect(byVoter.data).toHaveLength(2);
  });

  it("rejects an out-of-range support value", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({
      id: "prop-1:x",
      proposalId: "prop-1",
      voter: ADDR("1"),
      support: 5,
    } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("votes")).toHaveLength(0);
  });
});
