import { describe, it, expect } from "vitest";
import { createCertificatesRepository } from "./certificates.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const B32 = (c: string) => `0x${c.repeat(64)}`;
const ADDR = (c: string) => `0x${c.repeat(40)}`;

function seededRepo() {
  const fake = createFakeSupabase({ certificates: [] });
  return { fake, repo: createCertificatesRepository(fake.client as never) };
}

describe("CertificatesRepository", () => {
  it("upserts and reads back a certificate", async () => {
    const { repo } = seededRepo();
    const res = await repo.upsert({
      id: "cert-1",
      kind: "origin",
      batchId: B32("a"),
      holder: ADDR("1"),
      issuer: ADDR("2"),
      status: "valid",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.kind).toBe("origin");

    const found = await repo.findById("cert-1");
    if (isOk(found)) expect(found.data?.status).toBe("valid");
  });

  it("filters by batch, holder and kind", async () => {
    const { repo } = seededRepo();
    await repo.upsert({ id: "cert-1", kind: "origin", batchId: B32("a"), holder: ADDR("1") });
    await repo.upsert({ id: "cert-2", kind: "halal", batchId: B32("a"), holder: ADDR("1") });
    await repo.upsert({ id: "cert-3", kind: "origin", batchId: B32("b"), holder: ADDR("9") });

    const byBatch = await repo.findByBatch(B32("a"));
    if (isOk(byBatch)) expect(byBatch.data).toHaveLength(2);

    const byHolder = await repo.findByHolder(ADDR("1"));
    if (isOk(byHolder)) expect(byHolder.data).toHaveLength(2);

    const origin = await repo.findByKind("origin");
    if (isOk(origin)) expect(origin.data.map((c) => c.id).sort()).toEqual(["cert-1", "cert-3"]);
  });

  it("rejects a certificate with no kind", async () => {
    const { fake, repo } = seededRepo();
    const res = await repo.upsert({ id: "cert-x", kind: "" } as never);
    expect(isErr(res)).toBe(true);
    expect(fake.tables.get("certificates")).toHaveLength(0);
  });
});
