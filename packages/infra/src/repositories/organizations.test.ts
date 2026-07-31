import { describe, it, expect } from "vitest";
import { createOrganizationsRepository } from "./organizations.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";

const ADDR = (c: string) => `0x${c.repeat(40)}`;

function repo() {
  const fake = createFakeSupabase({ organizations: [] });
  return { fake, repo: createOrganizationsRepository(fake.client as never) };
}

describe("OrganizationsRepository", () => {
  it("upserts and reads back an organization with a default metadata object", async () => {
    const { repo: r } = repo();
    const res = await r.upsert({ id: "org-1", name: "Acme", admin: ADDR("1") });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.name).toBe("Acme");
      expect(res.data.metadata).toEqual({});
    }
    const found = await r.findById("org-1");
    if (isOk(found)) expect(found.data?.admin).toBe(ADDR("1"));
  });

  it("filters by admin and by type", async () => {
    const { repo: r } = repo();
    await r.upsert({ id: "a", name: "A", orgType: "supplier", admin: ADDR("1") });
    await r.upsert({ id: "b", name: "B", orgType: "buyer", admin: ADDR("1") });
    await r.upsert({ id: "c", name: "C", orgType: "supplier", admin: ADDR("9") });

    const byAdmin = await r.findByAdmin(ADDR("1"));
    if (isOk(byAdmin)) expect(byAdmin.data).toHaveLength(2);

    const suppliers = await r.findByType("supplier");
    if (isOk(suppliers)) expect(suppliers.data.map((o) => o.id).sort()).toEqual(["a", "c"]);
  });

  it("rejects a malformed admin address before hitting the DB", async () => {
    const { fake, repo: r } = repo();
    const res = await r.upsert({ id: "x", name: "X", admin: "not-an-address" } as never);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
    expect(fake.tables.get("organizations")).toHaveLength(0);
  });

  it("reads empty when unconfigured (null client)", async () => {
    const r = createOrganizationsRepository(null);
    const res = await r.find();
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data).toHaveLength(0);
  });
});
