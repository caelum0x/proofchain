/**
 * Commodities group handler.
 *
 * Owns `src/commodities/*` (tokenized commodities, harvest/grading/storage
 * registries, price oracle, vault). Beyond the audit table it projects two read
 * models: `HarvestRegistry.HarvestRegistered` → `harvests` (one row per harvest
 * lot) and `PriceOracle.PriceUpdated` → `commodity_prices` (an append-only price
 * tick keyed by the event's natural `tx:logIndex`, so re-indexing is idempotent).
 */
import type { DecodedEvent, HandlerDeps } from '../types.js';
import { eventKey, makeHandler, type Projector } from './base.js';
import { lower, secondsToIso, str } from './util.js';

/** Contracts routed to this handler (feeds the derived contract→group table). */
const CONTRACTS: readonly string[] = [
  'CommodityToken',
  'HarvestRegistry',
  'GradingRegistry',
  'StorageReceipt',
  'PriceOracle',
  'CommodityVault',
];

type HarvestRow = {
  id: string;
  farmer: string;
  batch_id: string | null;
  crop: string | null;
  yield_kg: string;
  status: string;
  metadata: Record<string, unknown>;
};

type PriceRow = {
  id: string;
  symbol: string | null;
  price: string;
  source: string | null;
  observed_at?: string;
  metadata: Record<string, unknown>;
};

const projectHarvest = async (
  event: DecodedEvent,
  deps: HandlerDeps,
): Promise<void> => {
  const harvestId = lower(event.args.harvestId);
  const farmer = lower(event.args.producer);
  const yieldKg = str(event.args.quantityKg);
  if (harvestId === undefined || farmer === undefined || yieldKg === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'commodities: HarvestRegistered missing required fields; skipping projection',
    );
    return;
  }
  await deps.db.upsert<HarvestRow>(
    'harvests',
    {
      id: harvestId,
      farmer,
      batch_id: null,
      crop: str(event.args.crop) ?? null,
      yield_kg: yieldKg,
      status: 'recorded',
      metadata: 'season' in event.args ? { season: event.args.season } : {},
    },
    'id',
  );
};

const projectPrice = async (
  event: DecodedEvent,
  deps: HandlerDeps,
): Promise<void> => {
  const price = str(event.args.price);
  if (price === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'commodities: PriceUpdated missing price; skipping projection',
    );
    return;
  }
  const observedAt = secondsToIso(event.args.updatedAt);
  await deps.db.upsert<PriceRow>(
    'commodity_prices',
    {
      id: eventKey(event),
      symbol: str(event.args.symbol) ?? null,
      price,
      source: event.contract,
      ...(observedAt !== null ? { observed_at: observedAt } : {}),
      metadata: {},
    },
    'id',
  );
};

const projectCommodities: Projector = async (
  event: DecodedEvent,
  deps: HandlerDeps,
) => {
  if (!deps.db.isConfigured) return;
  const contract: string = event.contract; // widen for sound literal comparison
  if (contract === 'HarvestRegistry' && event.eventName === 'HarvestRegistered') {
    await projectHarvest(event, deps);
    return;
  }
  if (contract === 'PriceOracle' && event.eventName === 'PriceUpdated') {
    await projectPrice(event, deps);
  }
};

export default makeHandler('commodities', projectCommodities, CONTRACTS);
