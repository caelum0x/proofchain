# @proofchain/api

Backend REST API for ProofChain — a Fastify + TypeScript service that reads the
chain (viem via `@proofchain/shared`) and Supabase (via `@proofchain/infra`),
serves the web app, and runs an **event indexer** that ingests on-chain events
into Supabase read models.

It is SEPARATE from `@proofchain/agent` (the AI verification service). This
package holds no private keys: it is a read/index service.

## Layout

```
src/
  index.ts            Composition root (build deps → server → listen)
  server.ts           Fastify factory + AUTOLOADER for src/routes/
  context.ts          AppContext (config/logger/chain/db) decorated on the instance
  config/
    env.ts            zod-validated env (fail-fast)
    constants.ts      non-secret defaults
  logger.ts           pino (redacts secrets)
  lib/
    chain.ts          viem read client + contract source resolution
    db.ts             generic typed Supabase query layer (graceful no-op)
    envelope.ts       { success, data, error } helpers
    errors.ts         ApiError + status mapping + toApiError
    route.ts          defineRoutes() — the router convention
    pagination.ts     parsePagination / pageMeta
  routes/             AUTO-LOADED plugin files (one per endpoint group)
    health.ts         reference router
  indexer/
    indexer.ts        engine: scan → decode → dispatch, cursor store
    runner.ts         polling loop (start/stop/tick)
    types.ts          DecodedEvent, handler interface, contract→group table
    handlers/         one handler per contract group (M0–M10)
```

## Scripts

| Script      | Purpose                                    |
| ----------- | ------------------------------------------ |
| `dev`       | `tsx watch src/index.ts`                   |
| `build`     | `tsup` (compiles the `src/` tree to `dist/`, preserving `routes/`) |
| `start`     | `node dist/index.js`                       |
| `test`      | `vitest run`                               |
| `typecheck` | `tsc --noEmit`                             |

## Environment

See `.env.example`. Required: `BASE_SEPOLIA_RPC_URL`. Supabase (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`) is optional — the DB layer degrades to a no-op
(reads empty, writes rejected) so the service still boots. No secret is
hardcoded; every value is validated at startup.

---

## Router convention (READ THIS before adding a route)

Routes are **auto-registered**. There is NO central registry: `server.ts`
registers `@fastify/autoload` against `src/routes/`, so any file you drop there
is picked up automatically. Follow these rules exactly:

1. **One file per endpoint group**, named for the group: `src/routes/suppliers.ts`,
   `src/routes/deals.ts`, etc. Test files (`*.test.ts`) are ignored by the loader.

2. **Default-export `defineRoutes(...)`.** The registrar receives the Fastify
   instance and the typed `AppContext` (`config`, `logger`, `chain`, `db`).
   Never import globals — everything arrives as an argument.

   ```ts
   // src/routes/suppliers.ts
   import { z } from 'zod';
   import { defineRoutes } from '../lib/route.js';
   import { ok, okPage } from '../lib/envelope.js';
   import { notFound, validationError } from '../lib/errors.js';
   import { pageMeta, parsePagination } from '../lib/pagination.js';

   const AddressParam = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) });

   export default defineRoutes(async (app, ctx) => {
     // LIST — paginated
     app.get('/suppliers', async (request) => {
       const page = parsePagination(request.query);
       const [rows, total] = await Promise.all([
         ctx.db.list('suppliers', { limit: page.limit, offset: page.offset, order: { column: 'created_at', ascending: false } }),
         ctx.db.count('suppliers'),
       ]);
       return okPage(rows, pageMeta(total, page));
     });

     // DETAIL
     app.get('/suppliers/:address', async (request) => {
       const parsed = AddressParam.safeParse(request.params);
       if (!parsed.success) throw validationError('Invalid address', parsed.error.issues);
       const row = await ctx.db.getBy('suppliers', 'address', parsed.data.address.toLowerCase());
       if (row === null) throw notFound('Supplier not found');
       return ok(row);
     });
   });
   ```

3. **Return the envelope, throw for errors.** Handlers `return ok(data)` /
   `return okPage(rows, meta)`. On failure, `throw` an `ApiError`
   (`validationError`, `notFound`, `chainError`, `dbError`, …) — the central
   error handler in `server.ts` converts it to `{ success, data, error }` with
   the right status code. Never format an error response by hand, and never
   leak a raw driver/stack message.

4. **Validate every input with zod** (params, query, body) at the boundary.
   Use `parsePagination(request.query)` for list endpoints. Lowercase hex
   addresses/hashes before querying (the DB stores them lowercase).

5. **Read data through `ctx.db`** (generic list/getBy/count/upsert/insert) and
   the chain through `ctx.chain`. Do not construct a viem client or a Supabase
   client in a route.

6. **Route paths are unprefixed** — the file owns its full path (`/suppliers`).
   Give related endpoints a shared prefix in their path string.

## Indexer convention

Each contract belongs to a **module group** (see `indexer/types.ts` →
`GROUP_BY_CONTRACT`). One handler file per group lives in `indexer/handlers/`.
Every decoded event is first written to the append-only `indexer_events` audit
table (idempotent on `txHash:logIndex`); a handler may additionally **project**
the event into a read-model table — see `handlers/settlement.ts`, which projects
`SettlementEscrow` events into `deals`. To extend a group, supply a `project`
function via `makeHandler(group, project)`; the engine wiring never changes.

The indexer runs only when `INDEXER_ENABLED=true`, advancing a per-contract
cursor (`indexer_cursors`) each tick with `INDEXER_CONFIRMATIONS` blocks of reorg
safety.

## Testability

The package is independently testable with **no network, no RPC, no Supabase**:
`@proofchain/shared` and `@proofchain/infra` resolve to in-package doubles
(`test/doubles/*.ts`) via the vitest + tsconfig aliases. The production build
(`tsup`) marks both as external, so the real workspace packages are used at
runtime.
