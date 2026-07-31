/**
 * Generic, dependency-free plugin registry.
 *
 * Every extensible category in the agent (parsers, checks, scorers, risk models,
 * tools, pipelines) is backed by one of these. A registry is a keyed collection
 * with self-registration semantics: a plugin module calls `register(item)` at
 * import time, so new capabilities are added by CREATING A FILE — never by
 * editing this file or a shared switch statement.
 *
 * Design notes:
 *   - Insertion order is preserved by `all()` so behaviour is deterministic.
 *   - Duplicate keys throw a CONFIG_ERROR by default: two plugins claiming the
 *     same id is a wiring bug we want to surface loudly, not silently clobber.
 *   - `reset()` exists purely for test isolation (never used in production code).
 */
import { AppError } from '../errors.js';

export interface RegistryOptions<T> {
  /** Human-readable label used in error messages, e.g. "cross-check". */
  readonly label: string;
  /** Extracts the unique key for an item (its stable id). */
  readonly keyOf: (item: T) => string;
  /**
   * When true, re-registering the same key replaces the previous item instead
   * of throwing. Defaults to false (collisions are treated as bugs).
   */
  readonly allowOverride?: boolean;
}

export interface Registry<T> {
  /** Register a single item. Returns the item for convenient chaining. */
  register(item: T): T;
  /** Register many items in order. */
  registerAll(items: readonly T[]): void;
  /** Look up by key; undefined when absent. */
  get(key: string): T | undefined;
  /** Look up by key; throws CONFIG_ERROR when absent. */
  require(key: string): T;
  has(key: string): boolean;
  /** All registered items in insertion order (immutable snapshot). */
  all(): readonly T[];
  /** All registered keys in insertion order. */
  keys(): readonly string[];
  size(): number;
  /** Remove every item. TEST-ONLY — do not call from production paths. */
  reset(): void;
}

export const createRegistry = <T>(options: RegistryOptions<T>): Registry<T> => {
  const { label, keyOf, allowOverride = false } = options;
  const items = new Map<string, T>();

  const assertKey = (key: string): void => {
    if (typeof key !== 'string' || key.length === 0) {
      throw new AppError(
        'CONFIG_ERROR',
        `Cannot register a ${label} with an empty key`,
      );
    }
  };

  const register = (item: T): T => {
    const key = keyOf(item);
    assertKey(key);
    if (!allowOverride && items.has(key)) {
      throw new AppError(
        'CONFIG_ERROR',
        `Duplicate ${label} registration for key "${key}"`,
        { key },
      );
    }
    items.set(key, item);
    return item;
  };

  return {
    register,
    registerAll: (list) => {
      for (const item of list) register(item);
    },
    get: (key) => items.get(key),
    require: (key) => {
      const found = items.get(key);
      if (found === undefined) {
        throw new AppError('CONFIG_ERROR', `Unknown ${label}: "${key}"`, {
          key,
          available: [...items.keys()],
        });
      }
      return found;
    },
    has: (key) => items.has(key),
    all: () => [...items.values()],
    keys: () => [...items.keys()],
    size: () => items.size,
    reset: () => items.clear(),
  };
};
