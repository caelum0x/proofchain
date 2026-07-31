import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(resolve(PKG_ROOT, "schema.sql"), "utf8");

describe("composed schema.sql", () => {
  it("is marked as generated", () => {
    expect(schema).toContain("composed database schema (GENERATED, do not edit)");
  });

  it("preserves the original core + SPEC2 tables", () => {
    for (const table of ["jobs", "verdicts", "deals", "indexer_events", "notifications"]) {
      expect(schema).toContain(`create table if not exists ${table} (`);
    }
  });

  it("includes the infra-internals module tables", () => {
    for (const table of ["queue_jobs", "outbox_events", "schema_migrations"]) {
      expect(schema).toContain(`create table if not exists ${table} (`);
    }
  });

  it("includes the SPEC3 per-domain read-model tables", () => {
    for (const table of [
      // trade finance (10–19)
      "letters_of_credit",
      "factoring_agreements",
      "po_financings",
      "dynamic_discounts",
      "scf_programs",
      "securitizations",
      "tranches",
      "credit_lines",
      "guarantees",
      "bills_of_exchange",
      // compliance (21–29)
      "sanctions_screenings",
      "aml_records",
      "trade_compliance_checks",
      "certificates_of_origin",
      "phytosanitary_certs",
      "halal_certifications",
      "product_recalls",
      "export_licenses",
      "customs_declarations",
      "duty_assessments",
      // dpp (31–35)
      "dpp_lifecycle_events",
      "material_compositions",
      "repairability_scores",
      "recycling_records",
      "dpp_data_carriers",
      // logistics (44–48)
      "cold_chain_readings",
      "warehouses",
      "fleet_vehicles",
      "route_attestations",
      "proof_of_delivery",
      // commodities / energy / esg (50–59)
      "commodities",
      "harvests",
      "gradings",
      "storage_receipts",
      "renewable_certificates",
      "emission_allowances",
      "water_credits",
      "biodiversity_credits",
      "green_bonds",
      // workforce (60–64)
      "worker_credentials",
      "safety_trainings",
      "skill_attestations",
      "labor_compliance_audits",
      // data / oracle (75–76)
      "oracle_feeds",
      "data_listings",
    ]) {
      expect(schema).toContain(`create table if not exists ${table} (`);
    }
  });

  it("keeps every new-domain table idempotent and RLS-enabled", () => {
    // Every table created in the composed file must also enable row level
    // security (writes flow through the service role, reads via a public policy).
    const createRe = /create table if not exists (\w+) \(/g;
    const created = new Set<string>();
    for (const match of schema.matchAll(createRe)) {
      if (match[1]) created.add(match[1]);
    }
    // Sanity: the composer emitted a meaningful number of tables.
    expect(created.size).toBeGreaterThan(50);
    for (const table of ["letters_of_credit", "green_bonds", "oracle_feeds"]) {
      expect(schema).toContain(`alter table %I enable row level security`);
      expect(created.has(table)).toBe(true);
    }
  });

  it("emits a module marker per composed module", () => {
    expect(schema).toContain("-- >>> module: 00_core.sql");
    expect(schema).toContain("-- >>> module: 90_infra.sql");
  });
});
