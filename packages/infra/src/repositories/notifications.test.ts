import { describe, it, expect } from "vitest";
import { createNotificationsRepository } from "./notifications.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ notifications: [] });
  return { fake, repo: createNotificationsRepository(fake.client as never) };
}

describe("NotificationsRepository", () => {
  it("creates a notification with a generated id", async () => {
    const { repo } = seededRepo();
    const res = await repo.create({
      recipient: ADDR("1"),
      kind: "deal.funded",
      payload: { batchId: "0xabc" },
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.kind).toBe("deal.funded");
      expect(res.data.read).toBe(false);
      expect(res.data.id).toMatch(/[0-9a-f-]{36}/);
    }
  });

  it("lists, counts and marks unread notifications", async () => {
    const { repo } = seededRepo();
    await repo.create({ recipient: ADDR("1"), kind: "a" });
    const second = await repo.create({ recipient: ADDR("1"), kind: "b" });
    await repo.create({ recipient: ADDR("9"), kind: "c" });

    const forOne = await repo.findByRecipient(ADDR("1"));
    if (isOk(forOne)) expect(forOne.data).toHaveLength(2);

    const unread = await repo.countUnread(ADDR("1"));
    if (isOk(unread)) expect(unread.data).toBe(2);

    if (isOk(second)) {
      await repo.markRead(second.data.id);
      const stillUnread = await repo.countUnread(ADDR("1"));
      if (isOk(stillUnread)) expect(stillUnread.data).toBe(1);
    }
  });

  it("rejects a notification with no kind", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.create({ recipient: ADDR("1") } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("notifications")).toHaveLength(0);
  });
});
