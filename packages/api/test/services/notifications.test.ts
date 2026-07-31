/**
 * Notifications service tests — list scoping, unread counting, and idempotent
 * read-state transitions over an in-memory read model.
 */
import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createNotificationsService } from '../../src/services/notifications.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });
const RECIPIENT = `0x${'7'.repeat(40)}`;

const rows: Row[] = [
  { id: 'n1', recipient: RECIPIENT, kind: 'attested', read: false, created_at: '2026-01-03' },
  { id: 'n2', recipient: RECIPIENT, kind: 'settled', read: true, created_at: '2026-01-02' },
  { id: 'n3', recipient: RECIPIENT, kind: 'disputed', read: false, created_at: '2026-01-01' },
];

const makeCtx = (data: Record<string, readonly Row[]>): AppContext => ({
  config,
  logger: silentLogger,
  chain: makeChain(),
  db: makeDb(data),
});

const page = { limit: 25, offset: 0 };

describe('NotificationsService', () => {
  it('lists newest-first and filters by read flag', async () => {
    const svc = createNotificationsService(makeCtx({ notifications: rows }));
    const all = await svc.list({ pagination: page });
    expect(all.total).toBe(3);
    expect(all.rows[0]?.id).toBe('n1');

    const unread = await svc.list({ pagination: page, read: false });
    expect(unread.total).toBe(2);
  });

  it('counts unread notifications for a recipient', async () => {
    const svc = createNotificationsService(makeCtx({ notifications: rows }));
    expect(await svc.unreadCount(RECIPIENT)).toBe(2);
  });

  it('marks an unread notification read (idempotently)', async () => {
    const svc = createNotificationsService(makeCtx({ notifications: rows }));
    const updated = await svc.markRead('n1');
    expect(updated?.read).toBe(true);

    const already = await svc.markRead('n2');
    expect(already?.read).toBe(true);

    expect(await svc.markRead('missing')).toBeNull();
  });
});
