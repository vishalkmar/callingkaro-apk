// P29: a sleeping free Render server needs ~30-60s to wake; login must not fail at the normal 15s timeout.
import { CONFIG } from '@constants/config';

jest.mock('@services/api/client', () => {
  const api = { get: jest.fn(async () => ({ data: { data: { ok: true } } })), post: jest.fn(async () => ({ data: { data: {} } })) };
  return { __esModule: true, default: api, api, unwrap: async p => (await p).data.data, setAuthHandlers: jest.fn() };
});
const { api } = require('@services/api/client');
const authApi = require('@services/api/authApi');

beforeEach(() => jest.clearAllMocks());

test('wake-up timeout is longer than a Render cold start, normal timeout unchanged', () => {
  expect(CONFIG.SERVER_WAKE_TIMEOUT_MS).toBeGreaterThanOrEqual(60000);
  expect(CONFIG.API_TIMEOUT_MS).toBe(15000);
});

test('health, send-otp and verify-otp wait for a waking server', async () => {
  await authApi.healthCheck();
  await authApi.sendOtp('demo@callkaro.app');
  await authApi.verifyOtp({ email: 'demo@callkaro.app', otp: '246810', deviceId: 'd1', termsVersion: 'v1' });
  expect(api.get).toHaveBeenCalledWith('/health', { timeout: CONFIG.SERVER_WAKE_TIMEOUT_MS });
  expect(api.post.mock.calls.map(c => c[2])).toEqual([
    { timeout: CONFIG.SERVER_WAKE_TIMEOUT_MS },
    { timeout: CONFIG.SERVER_WAKE_TIMEOUT_MS },
  ]);
});

test('other calls keep the normal short timeout', async () => {
  await authApi.getMe();
  expect(api.get).toHaveBeenCalledWith('/me');
});

test('wakeServer never throws: a dead server just returns false', async () => {
  const { wakeServer } = require('@services/auth/authService');
  api.get.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'TIMEOUT' }));
  await expect(wakeServer()).resolves.toBe(false);
  await expect(wakeServer()).resolves.toBe(true);
});
