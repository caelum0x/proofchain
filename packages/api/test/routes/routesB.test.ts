/**
 * Routes-B suite — logistics / commodities / energy / workforce / data domains.
 *
 * Every route in this wave follows the resource-router convention (list /
 * search / detail over an indexed projection table). Rather than 29 near-
 * identical files, this spec-driven suite exercises each router end-to-end via
 * `app.inject` against the filtering in-memory Db — asserting the list window,
 * a search filter, a detail hit, and a 404 miss for each.
 */
import type { FastifyPluginAsync } from 'fastify';
import { describe, expect, it } from 'vitest';
import {
  createMemoryDb,
  makeContext,
  mountRouter,
} from '../support/domainMemoryDb.js';

import freight from '../../src/routes/freight.js';
import coldChain from '../../src/routes/cold-chain.js';
import warehouses from '../../src/routes/warehouses.js';
import fleet from '../../src/routes/fleet.js';
import routesAttestation from '../../src/routes/routes-attestation.js';
import customsBonded from '../../src/routes/customs-bonded.js';
import containers from '../../src/routes/containers.js';
import proofOfDelivery from '../../src/routes/proof-of-delivery.js';
import commodities from '../../src/routes/commodities.js';
import harvests from '../../src/routes/harvests.js';
import grading from '../../src/routes/grading.js';
import storageReceipts from '../../src/routes/storage-receipts.js';
import priceOracle from '../../src/routes/price-oracle.js';
import commodityVaults from '../../src/routes/commodity-vaults.js';
import recs from '../../src/routes/recs.js';
import emissionsTrading from '../../src/routes/emissions-trading.js';
import waterCredits from '../../src/routes/water-credits.js';
import biodiversity from '../../src/routes/biodiversity.js';
import greenBonds from '../../src/routes/green-bonds.js';
import workerCredentials from '../../src/routes/worker-credentials.js';
import safetyTraining from '../../src/routes/safety-training.js';
import payroll from '../../src/routes/payroll.js';
import skills from '../../src/routes/skills.js';
import laborCompliance from '../../src/routes/labor-compliance.js';
import sensors from '../../src/routes/sensors.js';
import qualityInspections from '../../src/routes/quality-inspections.js';
import labTests from '../../src/routes/lab-tests.js';
import oracles from '../../src/routes/oracles.js';
import dataMarket from '../../src/routes/data-market.js';

type Row = Record<string, unknown>;

interface RouteSpec {
  readonly plugin: FastifyPluginAsync;
  readonly path: string;
  readonly table: string;
  /** Column used for detail lookup (`id` for most, `symbol` for tickers). */
  readonly detailCol: string;
  /** Row matching the search filter (also the detail target). */
  readonly rowA: Row;
  /** Row NOT matching the search filter. */
  readonly rowB: Row;
  /** Query string that isolates `rowA` on the /search endpoint. */
  readonly filterQuery: string;
}

const A = `0x${'a'.repeat(40)}`;
const B = `0x${'b'.repeat(40)}`;

/** Spec factory for the common id-keyed + address-filtered routers. */
const idAddr = (
  plugin: FastifyPluginAsync,
  path: string,
  table: string,
  param: string,
): RouteSpec => ({
  plugin,
  path,
  table,
  detailCol: 'id',
  rowA: { id: 'r1', [param]: A, created_at: '2026-01-02' },
  rowB: { id: 'r2', [param]: B, created_at: '2026-01-01' },
  filterQuery: `${param}=${A}`,
});

const SPECS: readonly RouteSpec[] = [
  idAddr(freight, '/freight', 'freight', 'shipper'),
  {
    plugin: coldChain,
    path: '/cold-chain',
    table: 'cold_chain',
    detailCol: 'id',
    rowA: { id: 'r1', status: 'active', created_at: '2026-01-02' },
    rowB: { id: 'r2', status: 'completed', created_at: '2026-01-01' },
    filterQuery: 'status=active',
  },
  idAddr(warehouses, '/warehouses', 'warehouses', 'operator'),
  idAddr(fleet, '/fleet', 'fleet', 'operator'),
  idAddr(routesAttestation, '/routes-attestation', 'route_attestations', 'carrier'),
  idAddr(customsBonded, '/customs-bonded', 'customs_bonded', 'importer'),
  idAddr(containers, '/containers', 'containers', 'owner'),
  idAddr(proofOfDelivery, '/proof-of-delivery', 'proof_of_delivery', 'recipient'),
  {
    plugin: commodities,
    path: '/commodities',
    table: 'commodities',
    detailCol: 'symbol',
    rowA: { symbol: 'WHEAT', category: 'grain', created_at: '2026-01-02' },
    rowB: { symbol: 'CORN', category: 'metal', created_at: '2026-01-01' },
    filterQuery: 'category=grain',
  },
  idAddr(harvests, '/harvests', 'harvests', 'producer'),
  idAddr(grading, '/grading', 'grading', 'inspector'),
  idAddr(storageReceipts, '/storage-receipts', 'storage_receipts', 'holder'),
  {
    plugin: priceOracle,
    path: '/price-oracle',
    table: 'price_feeds',
    detailCol: 'symbol',
    rowA: { symbol: 'WHEAT', source: 'chainlink', created_at: '2026-01-02' },
    rowB: { symbol: 'CORN', source: 'pyth', created_at: '2026-01-01' },
    filterQuery: 'source=chainlink',
  },
  idAddr(commodityVaults, '/commodity-vaults', 'commodity_vaults', 'owner'),
  idAddr(recs, '/recs', 'recs', 'owner'),
  idAddr(emissionsTrading, '/emissions-trading', 'emissions_trades', 'buyer'),
  idAddr(waterCredits, '/water-credits', 'water_credits', 'owner'),
  idAddr(biodiversity, '/biodiversity', 'biodiversity_credits', 'owner'),
  idAddr(greenBonds, '/green-bonds', 'green_bonds', 'issuer'),
  idAddr(workerCredentials, '/worker-credentials', 'worker_credentials', 'worker'),
  idAddr(safetyTraining, '/safety-training', 'safety_training', 'worker'),
  idAddr(payroll, '/payroll', 'payroll', 'worker'),
  idAddr(skills, '/skills', 'skills', 'worker'),
  idAddr(laborCompliance, '/labor-compliance', 'labor_compliance', 'employer'),
  idAddr(sensors, '/sensors', 'sensors', 'owner'),
  idAddr(qualityInspections, '/quality-inspections', 'quality_inspections', 'inspector'),
  idAddr(labTests, '/lab-tests', 'lab_tests', 'lab'),
  idAddr(oracles, '/oracles', 'oracles', 'operator'),
  idAddr(dataMarket, '/data-market', 'data_listings', 'seller'),
];

const mount = async (spec: RouteSpec) => {
  const db = createMemoryDb();
  db.seed(spec.table, [spec.rowA, spec.rowB]);
  return mountRouter(spec.plugin, makeContext(db));
};

describe('routes-B resource routers', () => {
  it('covers all 29 wave-E domains', () => {
    expect(SPECS).toHaveLength(29);
  });

  for (const spec of SPECS) {
    describe(`GET ${spec.path}`, () => {
      it('lists all seeded rows in the envelope', async () => {
        const app = await mount(spec);
        const res = await app.inject({ method: 'GET', url: spec.path });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(2);
        expect(body.meta.total).toBe(2);
        await app.close();
      });

      it('filters via /search', async () => {
        const app = await mount(spec);
        const res = await app.inject({
          method: 'GET',
          url: `${spec.path}/search?${spec.filterQuery}`,
        });
        expect(res.statusCode).toBe(200);
        const data = res.json().data as Row[];
        expect(data).toHaveLength(1);
        expect(data[0]?.[spec.detailCol]).toBe(spec.rowA[spec.detailCol]);
        await app.close();
      });

      it('returns detail by key and 404s a miss', async () => {
        const app = await mount(spec);
        const key = String(spec.rowA[spec.detailCol]);
        const hit = await app.inject({
          method: 'GET',
          url: `${spec.path}/${encodeURIComponent(key)}`,
        });
        expect(hit.statusCode).toBe(200);
        expect(hit.json().data[spec.detailCol]).toBe(spec.rowA[spec.detailCol]);

        const miss = await app.inject({
          method: 'GET',
          url: `${spec.path}/zzz`,
        });
        expect(miss.statusCode).toBe(404);
        expect(miss.json().error.code).toBe('NOT_FOUND');
        await app.close();
      });
    });
  }
});
