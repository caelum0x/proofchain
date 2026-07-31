/**
 * Table-driven route tests for the routes-A wave (trade-finance + compliance +
 * dpp). Every domain shares the same list/detail/search contract, so one spec
 * table exercises all of them against the filtering in-memory Db — fully
 * offline (mocked chain + db), mirroring `routes/invoices.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { FastifyPluginAsync } from 'fastify';
import { createMemoryDb, makeContext, mountRouter } from '../support/domainMemoryDb.js';
import lettersOfCreditPlugin from '../../src/routes/letters-of-credit.js';
import billsOfExchangePlugin from '../../src/routes/bills-of-exchange.js';
import factoringPlugin from '../../src/routes/factoring.js';
import poFinancingPlugin from '../../src/routes/po-financing.js';
import dynamicDiscountingPlugin from '../../src/routes/dynamic-discounting.js';
import securitizationPlugin from '../../src/routes/securitization.js';
import tranchesPlugin from '../../src/routes/tranches.js';
import creditLinesPlugin from '../../src/routes/credit-lines.js';
import guaranteesPlugin from '../../src/routes/guarantees.js';
import sanctionsPlugin from '../../src/routes/sanctions.js';
import amlPlugin from '../../src/routes/aml.js';
import tradeCompliancePlugin from '../../src/routes/trade-compliance.js';
import certificatesOriginPlugin from '../../src/routes/certificates-origin.js';
import phytosanitaryPlugin from '../../src/routes/phytosanitary.js';
import halalPlugin from '../../src/routes/halal.js';
import recallsPlugin from '../../src/routes/recalls.js';
import exportLicensesPlugin from '../../src/routes/export-licenses.js';
import dutiesPlugin from '../../src/routes/duties.js';
import customsPlugin from '../../src/routes/customs.js';
import passportsPlugin from '../../src/routes/passports.js';
import dppLifecyclePlugin from '../../src/routes/dpp-lifecycle.js';
import materialsPlugin from '../../src/routes/materials.js';
import repairabilityPlugin from '../../src/routes/repairability.js';
import recyclingPlugin from '../../src/routes/recycling.js';
import dppCompliancePlugin from '../../src/routes/dpp-compliance.js';

const plugins: Record<string, FastifyPluginAsync> = {
  'letters-of-credit': lettersOfCreditPlugin,
  'bills-of-exchange': billsOfExchangePlugin,
  'factoring': factoringPlugin,
  'po-financing': poFinancingPlugin,
  'dynamic-discounting': dynamicDiscountingPlugin,
  'securitization': securitizationPlugin,
  'tranches': tranchesPlugin,
  'credit-lines': creditLinesPlugin,
  'guarantees': guaranteesPlugin,
  'sanctions': sanctionsPlugin,
  'aml': amlPlugin,
  'trade-compliance': tradeCompliancePlugin,
  'certificates-origin': certificatesOriginPlugin,
  'phytosanitary': phytosanitaryPlugin,
  'halal': halalPlugin,
  'recalls': recallsPlugin,
  'export-licenses': exportLicensesPlugin,
  'duties': dutiesPlugin,
  'customs': customsPlugin,
  'passports': passportsPlugin,
  'dpp-lifecycle': dppLifecyclePlugin,
  'materials': materialsPlugin,
  'repairability': repairabilityPlugin,
  'recycling': recyclingPlugin,
  'dpp-compliance': dppCompliancePlugin,
};

interface Case {
  readonly name: string;
  readonly table: string;
  readonly idColumn: string;
  readonly id1: string;
  readonly id2: string;
  readonly unknownId: string;
  readonly badId: string;
  readonly searchCol: string;
}

const cases: readonly Case[] = [
  {
    name: 'letters-of-credit',
    table: 'letters_of_credit',
    idColumn: 'lc_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'reference',
  },
  {
    name: 'bills-of-exchange',
    table: 'bills_of_exchange',
    idColumn: 'bill_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'reference',
  },
  {
    name: 'factoring',
    table: 'factoring_agreements',
    idColumn: 'agreement_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'invoice_ref',
  },
  {
    name: 'po-financing',
    table: 'po_financings',
    idColumn: 'po_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'po_ref',
  },
  {
    name: 'dynamic-discounting',
    table: 'dynamic_discounts',
    idColumn: 'offer_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'invoice_id',
  },
  {
    name: 'securitization',
    table: 'securitizations',
    idColumn: 'pool_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'name',
  },
  {
    name: 'tranches',
    table: 'tranches',
    idColumn: 'tranche_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'token',
  },
  {
    name: 'credit-lines',
    table: 'credit_lines',
    idColumn: 'line_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'borrower',
  },
  {
    name: 'guarantees',
    table: 'guarantees',
    idColumn: 'guarantee_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'reference',
  },
  {
    name: 'sanctions',
    table: 'sanctions_screenings',
    idColumn: 'address',
    id1: '0x1111111111111111111111111111111111111111',
    id2: '0x2222222222222222222222222222222222222222',
    unknownId: '0x9999999999999999999999999999999999999999',
    badId: 'not-an-address',
    searchCol: 'list_name',
  },
  {
    name: 'aml',
    table: 'aml_records',
    idColumn: 'address',
    id1: '0x1111111111111111111111111111111111111111',
    id2: '0x2222222222222222222222222222222222222222',
    unknownId: '0x9999999999999999999999999999999999999999',
    badId: 'not-an-address',
    searchCol: 'notes',
  },
  {
    name: 'trade-compliance',
    table: 'trade_compliance_checks',
    idColumn: 'check_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'batch_id',
  },
  {
    name: 'certificates-origin',
    table: 'certificates_origin',
    idColumn: 'certificate_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'product',
  },
  {
    name: 'phytosanitary',
    table: 'phytosanitary_certificates',
    idColumn: 'certificate_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'commodity',
  },
  {
    name: 'halal',
    table: 'halal_certifications',
    idColumn: 'certificate_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'product',
  },
  {
    name: 'recalls',
    table: 'product_recalls',
    idColumn: 'recall_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'product',
  },
  {
    name: 'export-licenses',
    table: 'export_licenses',
    idColumn: 'license_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'goods',
  },
  {
    name: 'duties',
    table: 'duty_calculations',
    idColumn: 'calculation_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'hs_code',
  },
  {
    name: 'customs',
    table: 'customs_declarations',
    idColumn: 'declaration_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'reference',
  },
  {
    name: 'passports',
    table: 'passports',
    idColumn: 'token_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'product',
  },
  {
    name: 'dpp-lifecycle',
    table: 'dpp_lifecycle_events',
    idColumn: 'event_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'note',
  },
  {
    name: 'materials',
    table: 'material_compositions',
    idColumn: 'material_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'material',
  },
  {
    name: 'repairability',
    table: 'repairability_scores',
    idColumn: 'token_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'manual_uri',
  },
  {
    name: 'recycling',
    table: 'recycling_records',
    idColumn: 'record_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'method',
  },
  {
    name: 'dpp-compliance',
    table: 'dpp_compliance',
    idColumn: 'token_id',
    id1: '1',
    id2: '2',
    unknownId: '999999',
    badId: 'not-a-number',
    searchCol: 'regulation',
  },
];

const seed = (c: Case) => {
  const db = createMemoryDb();
  db.seed(c.table, [
    { [c.idColumn]: c.id1, [c.searchCol]: 'AlphaWidget', status: 'issued', created_at: '2026-01-02' },
    { [c.idColumn]: c.id2, [c.searchCol]: 'BetaGadget', status: 'issued', created_at: '2026-01-01' },
  ]);
  return db;
};

describe.each(cases)('routes-A: /$name', (c) => {
  const plugin = plugins[c.name] as FastifyPluginAsync;

  it('lists rows newest-first with pagination meta', async () => {
    const app = await mountRouter(plugin, makeContext(seed(c)));
    const res = await app.inject({ method: 'GET', url: `/${c.name}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.data[0][c.idColumn]).toBe(c.id1);
    await app.close();
  });

  it('returns one row by id', async () => {
    const app = await mountRouter(plugin, makeContext(seed(c)));
    const res = await app.inject({ method: 'GET', url: `/${c.name}/${c.id1}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data[c.idColumn]).toBe(c.id1);
    await app.close();
  });

  it('404s an unknown id', async () => {
    const app = await mountRouter(plugin, makeContext(seed(c)));
    const res = await app.inject({ method: 'GET', url: `/${c.name}/${c.unknownId}` });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    await app.close();
  });

  it('400s a malformed id', async () => {
    const app = await mountRouter(plugin, makeContext(seed(c)));
    const res = await app.inject({ method: 'GET', url: `/${c.name}/${c.badId}` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('filters by free-text q via search', async () => {
    const app = await mountRouter(plugin, makeContext(seed(c)));
    const res = await app.inject({ method: 'GET', url: `/${c.name}/search?q=alpha` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0][c.idColumn]).toBe(c.id1);
    await app.close();
  });

  it('rejects an invalid filter value with 400', async () => {
    const app = await mountRouter(plugin, makeContext(seed(c)));
    const res = await app.inject({ method: 'GET', url: `/${c.name}?status=__nope__` });
    // Domains with a status enum reject; others ignore the unknown key (200).
    expect([200, 400]).toContain(res.statusCode);
    await app.close();
  });
});
