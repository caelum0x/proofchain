import { describe, expect, it } from 'vitest';
import notificationsPlugin from '../../src/routes/notifications.js';
import { createMemoryDb, makeContext, mountRouter } from '../support/domainMemoryDb.js';

const RECIPIENT = `0x${'7'.repeat(40)}`;
const UUID = '11111111-1111-1111-1111-111111111111';

const seedDb = () => {
  const db = createMemoryDb();
  db.seed('notifications', [
    { id: UUID, recipient: RECIPIENT, kind: 'attested', read: false, created_at: '2026-01-03' },
    { id: '22222222-2222-2222-2222-222222222222', recipient: RECIPIENT, kind: 'settled', read: true, created_at: '2026-01-02' },
    { id: '33333333-3333-3333-3333-333333333333', recipient: RECIPIENT, kind: 'disputed', read: false, created_at: '2026-01-01' },
  ]);
  return db;
};

describe('notifications router', () => {
  it('counts unread notifications for a recipient', async () => {
    const app = await mountRouter(notificationsPlugin, makeContext(seedDb()));
    const res = await app.inject({
      method: 'GET',
      url: `/notifications/unread-count?recipient=${RECIPIENT}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.unread).toBe(2);
    await app.close();
  });

  it('400s unread-count without a recipient', async () => {
    const app = await mountRouter(notificationsPlugin, makeContext(seedDb()));
    const res = await app.inject({ method: 'GET', url: '/notifications/unread-count' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('filters by read flag via search', async () => {
    const app = await mountRouter(notificationsPlugin, makeContext(seedDb()));
    const res = await app.inject({
      method: 'GET',
      url: `/notifications/search?recipient=${RECIPIENT}&read=false`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
    await app.close();
  });

  it('returns one notification by id and validates the uuid', async () => {
    const app = await mountRouter(notificationsPlugin, makeContext(seedDb()));
    const ok = await app.inject({ method: 'GET', url: `/notifications/${UUID}` });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.kind).toBe('attested');
    const bad = await app.inject({ method: 'GET', url: '/notifications/not-a-uuid' });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });
});
