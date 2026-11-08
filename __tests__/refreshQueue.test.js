import { createRefreshQueue } from '@services/api/refreshQueue';

describe('refresh queue', () => {
  test('parallel 401s trigger exactly one refresh and all get the same token', async () => {
    let calls = 0;
    const q = createRefreshQueue(async () => {
      calls += 1;
      await new Promise(r => setTimeout(r, 20));
      return `token-${calls}`;
    });
    const results = await Promise.all([q.refresh(), q.refresh(), q.refresh(), q.refresh()]);
    expect(calls).toBe(1);
    expect(new Set(results)).toEqual(new Set(['token-1']));
    expect(q.isRefreshing()).toBe(false);
  });

  test('a later refresh after completion runs again', async () => {
    let calls = 0;
    const q = createRefreshQueue(async () => ++calls);
    await q.refresh();
    await q.refresh();
    expect(calls).toBe(2);
  });

  test('failure is shared by waiters and the queue resets', async () => {
    let calls = 0;
    const q = createRefreshQueue(async () => {
      calls += 1;
      throw new Error('nope');
    });
    const r = await Promise.allSettled([q.refresh(), q.refresh()]);
    expect(r.every(x => x.status === 'rejected')).toBe(true);
    expect(calls).toBe(1);
    await expect(q.refresh()).rejects.toThrow('nope');
    expect(calls).toBe(2);
  });
});
