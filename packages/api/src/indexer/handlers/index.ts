/**
 * Handler registry — maps every {@link ContractGroup} to its handler. The engine
 * looks a handler up by group for each decoded event. Adding a group means
 * adding a file here + a row in the routing table (`../types.ts`); the engine
 * itself never changes.
 */
import type { ContractGroup, IndexerHandler } from '../types.js';
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
];

export const HANDLERS: ReadonlyMap<ContractGroup, IndexerHandler> = new Map(
  ALL.map((h) => [h.group, h]),
);

/** Resolve the handler for a group, falling back to the `core` handler. */
export const getHandler = (group: ContractGroup): IndexerHandler =>
  HANDLERS.get(group) ?? core;
