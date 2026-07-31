/**
 * Shared handler machinery.
 *
 * EVERY decoded event is first persisted to the append-only `indexer_events`
 * audit table (keyed by `txHash:logIndex`, so re-processing a range is
 * idempotent). A group handler may additionally PROJECT the event into a
 * purpose-built read-model table (see `settlement.ts` for a worked example);
 * groups without a projection yet still capture their events losslessly here, so
 * nothing is dropped and no handler is dead weight.
 */
import type { DecodedEvent, ContractGroup, HandlerDeps, IndexerHandler } from '../types.js';

/** Natural, idempotent key for an event: unique per (tx, logIndex). */
export const eventKey = (event: DecodedEvent): string =>
  `${event.transactionHash.toLowerCase()}:${event.logIndex}`;

/** Persist a decoded event to the `indexer_events` audit table (idempotent). */
export const persistEvent = async (
  event: DecodedEvent,
  deps: HandlerDeps,
): Promise<void> => {
  if (!deps.db.isConfigured) return; // graceful no-op without Supabase
  await deps.db.upsert(
    'indexer_events',
    {
      id: eventKey(event),
      group_name: event.group,
      contract: event.contract,
      address: event.address.toLowerCase(),
      event_name: event.eventName,
      args: event.args,
      block_number: event.blockNumber.toString(),
      tx_hash: event.transactionHash.toLowerCase(),
      log_index: event.logIndex,
    },
    'id',
  );
};

/** Optional projection step run AFTER the audit-table write. */
export type Projector = (event: DecodedEvent, deps: HandlerDeps) => Promise<void>;

/**
 * Build an {@link IndexerHandler} for a group: always audit, then optionally
 * project into a read-model table. Router-domain agents extend a group by
 * supplying a `project` function; the engine wiring never changes.
 *
 * `contracts` (optional) lists the contract names this handler owns. When set,
 * the registry routes those contracts' events to this handler automatically, so
 * a NEW domain needs only a handler file — no edit to `GROUP_BY_CONTRACT`.
 */
export const makeHandler = (
  group: ContractGroup,
  project?: Projector,
  contracts?: readonly string[],
): IndexerHandler => ({
  group,
  ...(contracts !== undefined ? { contracts } : {}),
  async handle(event, deps) {
    await persistEvent(event, deps);
    if (project !== undefined) {
      await project(event, deps);
    }
  },
});
