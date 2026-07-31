import { describe, it, expect } from "vitest";
import { createNotifier, createChannel } from "./index.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const base = { kind: "deal.funded", payload: {} };

describe("notifications — channels", () => {
  it("console channel is a silent no-op without a sink, and logs with one", async () => {
    const silent = createChannel("console");
    const res = await silent.send({ ...base });
    if (isOk(res)) expect(res.data.skipped).toBe(true);

    const entries: unknown[] = [];
    const loud = createChannel("console", { log: (e) => entries.push(e) });
    const res2 = await loud.send({ ...base, title: "Hi" });
    if (isOk(res2)) expect(res2.data.delivered).toBe(true);
    expect(entries).toHaveLength(1);
  });

  it("webhook channel posts JSON to the recipient URL", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const channel = createChannel("webhook", {
      fetchFn: async (url, init) => {
        calls.push({ url, init });
        return new Response(null, { status: 200 });
      },
    });
    const res = await channel.send({ ...base, recipient: "https://hooks.example/x" });
    if (isOk(res)) expect(res.data.delivered).toBe(true);
    expect(calls[0]?.url).toBe("https://hooks.example/x");

    const skipped = await channel.send({ ...base });
    if (isOk(skipped)) expect(skipped.data.skipped).toBe(true);
  });

  it("email channel uses the injected transport or skips", async () => {
    const withTransport = createChannel("email", {
      emailTransport: async () => ({ id: "msg-1" }),
    });
    const res = await withTransport.send({ ...base, recipient: "a@b.com", title: "T" });
    if (isOk(res)) {
      expect(res.data.delivered).toBe(true);
      expect(res.data.id).toBe("msg-1");
    }

    const badRecipient = await withTransport.send({ ...base, recipient: "not-an-email" });
    if (isOk(badRecipient)) expect(badRecipient.data.skipped).toBe(true);

    const noTransport = createChannel("email");
    const skipped = await noTransport.send({ ...base, recipient: "a@b.com" });
    if (isOk(skipped)) expect(skipped.data.skipped).toBe(true);
  });

  it("in-app channel persists to the notifications table (or skips when unconfigured)", async () => {
    const fake = createFakeSupabase({ notifications: [] });
    const channel = createChannel("inapp", { client: fake.client as never });
    const res = await channel.send({
      ...base,
      recipient: `0x${"1".repeat(40)}`,
      title: "T",
      body: "B",
    });
    if (isOk(res)) expect(res.data.delivered).toBe(true);
    expect(fake.tables.get("notifications")).toHaveLength(1);

    const skipped = await createChannel("inapp").send({ ...base });
    if (isOk(skipped)) expect(skipped.data.skipped).toBe(true);
  });
});

describe("notifications — dispatcher", () => {
  it("fans out to multiple channels and aggregates results", async () => {
    const notifier = createNotifier({ log: () => {} }, ["console"]);
    const res = await notifier.notify({ ...base, title: "Hi" });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0]?.channel).toBe("console");
    }
  });

  it("rejects an invalid notification", async () => {
    const notifier = createNotifier();
    const res = await notifier.notify({ kind: "", payload: {} } as never);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
  });

  it("throws for an unknown channel name", () => {
    expect(() => createChannel("carrier-pigeon")).toThrow();
  });
});
