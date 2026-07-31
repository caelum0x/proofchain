/**
 * Handler registry — maps every {@link ContractGroup} to its handler, and
 * derives the contract→group routing from what each handler DECLARES. The engine
 * looks a handler up by group for each decoded event.
 *
 * Fill-agent convention — to onboard a domain, ONLY two edits:
 *   1. ADD `handlers/<domain>.ts` (`export default makeHandler('<domain>',
 *      projector, ['ContractA', 'ContractB'])`).
 *   2. Append that module to the `ALL` array below (one import + one entry).
 * No edit to the engine, the runner, or — when the handler declares its
 * `contracts` — the static `GROUP_BY_CONTRACT` table. The group name is a plain
 * string, so brand-new domains never touch a union type.
 */
import { type ContractGroup, type IndexerHandler, groupFor } from '../types.js';
import core from './core.js';
import provenance from './provenance.js';
import settlement from './settlement.js';
import identity from './identity.js';
import reputation from './reputation.js';
import finance from './finance.js';
import insurance from './insurance.js';
import governance from './governance.js';
import esg from './esg.js';
import marketplace from './marketplace.js';
import rewards from './rewards.js';
import tradefinance from './tradefinance.js';
import compliance from './compliance.js';
import dpp from './dpp.js';
import logistics from './logistics.js';
import commodities from './commodities.js';
import energy from './energy.js';
import workforce from './workforce.js';
import data from './data.js';

const ALL: readonly IndexerHandler[] = [
  core,
  provenance,
  settlement,
  identity,
  reputation,
  finance,
  insurance,
  governance,
  esg,
  marketplace,
  rewards,
  tradefinance,
  compliance,
  dpp,
  logistics,
  commodities,
  energy,
  workforce,
  data,
];

export const HANDLERS: ReadonlyMap<ContractGroup, IndexerHandler> = new Map(
  ALL.map((h) => [h.group, h]),
);

/** Contract→group routes DECLARED by handlers (override the static table). */
const DECLARED_ROUTES: ReadonlyMap<string, ContractGroup> = new Map(
  ALL.flatMap((h) => (h.contracts ?? []).map((c) => [c, h.group] as const)),
);

/** Resolve the handler for a group, falling back to the `core` handler. */
export const getHandler = (group: ContractGroup): IndexerHandler =>
  HANDLERS.get(group) ?? core;

/**
 * Resolve the group for a contract: a handler's own `contracts` declaration wins,
 * then the static {@link GROUP_BY_CONTRACT} table (`groupFor`), else `core`. This
 * is the single routing entry point the engine uses when decoding a log.
 */
export const routeContract = (contract: string): ContractGroup =>
  DECLARED_ROUTES.get(contract) ?? groupFor(contract);
