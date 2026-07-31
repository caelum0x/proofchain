import { describe, it, expect } from "vitest";
import { runMigrations, createMigrationRunner } from "./runner.js";
import { registeredMigrations } from "./registry.js";
import { isOk, isErr } from "../errors.js";
import { createFakeSupabase } from "../testing/supabase-fake.js";
// Import the subsystem entrypoint so bundled migrations self-register.
import "./index.js";

const m = (id: string) => ({
  id,
  name: `migration ${id}`,
  statements: [`select ${id}`],
});

describe("migration runner", () => {
  it("performs a dry run when no executor/client is provided", async () => {
    const res = await runMigrations([m("0001_a"), m("0002_b")]);
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.applied).toEqual([]);
      expect(res.data.pending).toEqual(["0001_a", "0002_b"]);
    }
  });

  it("applies pending migrations and records them in the ledger", async () => {
    const fake = createFakeSupabase({ schema_migrations: [] });
    const executed: string[] = [];
    const runner = createMigrationRunner({
      client: fake.client as never,
      execute: async (sql) => {
        executed.push(sql);
      },
    });

    const first = await runner.run([m("0001_a"), m("0002_b")]);
    if (isOk(first)) {
      expect(first.data.applied).toEqual(["0001_a", "0002_b"]);
    }
    expect(executed).toEqual(["select 0001_a", "select 0002_b"]);
    expect(fake.tables.get("schema_migrations")).toHaveLength(2);

    // Re-running skips already-applied migrations.
    const second = await runner.run([m("0001_a"), m("0002_b")]);
    if (isOk(second)) {
      expect(second.data.applied).toEqual([]);
      expect(second.data.skipped).toEqual(["0001_a", "0002_b"]);
    }
  });

  it("rejects duplicate migration ids", async () => {
    const res = await runMigrations([m("0001_a"), m("0001_a")]);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
  });

  it("registers the bundled example migration", () => {
    expect(registeredMigrations().some((mig) => mig.id === "0001_add_indexes")).toBe(true);
  });
});
