/**
 * Deterministic in-package double for `@proofchain/infra`.
 *
 * The API only uses `createSupabaseStore(...).raw()` to borrow the underlying
 * client. By default `raw()` is null (so the DB layer exercises its graceful
 * no-op path). Tests that want to drive the LIVE query path install a fake
 * PostgREST-shaped client via `__setRawClient(...)`; `createSupabaseStore`
 * returns it whenever the config is `configured`.
 */
export interface FakeStore {
  raw(): unknown | null;
}

let injectedRawClient: unknown | null = null;

/** Test-only: set the fake raw client returned for configured stores. */
export const __setRawClient = (client: unknown | null): void => {
  injectedRawClient = client;
};

export const createSupabaseStore = async (config: {
  supabase: { configured: boolean; url?: string; serviceRoleKey?: string };
  ipfs?: { configured: boolean; apiUrl: string; gatewayUrl: string; jwt?: string };
}): Promise<FakeStore> => {
  if (!config.supabase.configured) {
    return { raw: () => null };
  }
  return { raw: () => injectedRawClient };
};
