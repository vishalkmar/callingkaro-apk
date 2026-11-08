import axios from 'axios';
import { CONFIG } from '@constants/config';
import logger from '@utils/logger';
import { getAccessToken, getRefreshToken, saveTokens } from '@services/storage/secureStore';
import { createRefreshQueue } from './refreshQueue';

const log = logger.scope('api');

export class ApiError extends Error {
  constructor({ code = 'UNKNOWN', message = 'Something went wrong', status = 0, data } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

// Registered by authService to avoid a circular import.
const handlers = { onSessionExpired: () => {}, onBlocked: () => {} };
export const setAuthHandlers = h => Object.assign(handlers, h);

export const api = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: CONFIG.API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

const NO_AUTH_PATHS = ['/auth/send-otp', '/auth/verify-otp', '/auth/refresh', '/health'];

api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token && !NO_AUTH_PATHS.some(p => config.url?.startsWith(p))) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const refreshQueue = createRefreshQueue(async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError({ code: 'NO_SESSION', status: 401, message: 'Please login again' });
  }
  // Plain axios (not `api`) so this request never re-enters the 401 interceptor.
  const res = await axios.post(
    `${CONFIG.API_BASE_URL}/auth/refresh`,
    { refreshToken },
    { timeout: CONFIG.API_TIMEOUT_MS },
  );
  const tokens = res.data?.data;
  await saveTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  return tokens.accessToken;
});

export const toApiError = error => {
  if (error instanceof ApiError) {
    return error;
  }
  if (error?.response) {
    const body = error.response.data || {};
    return new ApiError({
      code: body.code || `HTTP_${error.response.status}`,
      message: body.message || 'Request failed',
      status: error.response.status,
      data: body.data,
    });
  }
  if (error?.code === 'ECONNABORTED') {
    return new ApiError({ code: 'TIMEOUT', message: 'The server took too long to respond. Try again.' });
  }
  return new ApiError({ code: 'NETWORK', message: 'Service unavailable, try later' });
};

api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config || {};
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (code === 'USER_BLOCKED') {
      handlers.onBlocked(error.response?.data?.message);
      return Promise.reject(toApiError(error));
    }

    const isAuthPath = NO_AUTH_PATHS.some(p => original.url?.startsWith(p));
    if (status === 401 && !original._retry && !isAuthPath) {
      original._retry = true;
      try {
        const token = await refreshQueue.refresh();
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${token}` };
        return api(original);
      } catch (refreshError) {
        const err = toApiError(refreshError);
        // Only a real "your session is gone" answer logs the user out. No internet / timeout /
        // server error during refresh keeps the session so the next request can try again.
        if (err.status === 401 || err.status === 403 || err.code === 'NO_SESSION') {
          log.warn('refresh rejected -> session expired', err.code);
          handlers.onSessionExpired();
        } else {
          log.warn('refresh failed (temporary) - keeping session', err.code);
        }
        return Promise.reject(err);
      }
    }
    return Promise.reject(toApiError(error));
  },
);

// Unwraps { success, data } envelopes.
export const unwrap = promise => promise.then(res => res.data?.data);

export default api;
