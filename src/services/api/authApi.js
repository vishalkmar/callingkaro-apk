import api, { unwrap } from './client';
import { CONFIG } from '@constants/config';

const WAKE = { timeout: CONFIG.SERVER_WAKE_TIMEOUT_MS };

export const healthCheck = () => unwrap(api.get('/health', WAKE));
export const sendOtp = email => unwrap(api.post('/auth/send-otp', { email }, WAKE));
export const verifyOtp = ({ email, otp, deviceId, termsVersion }) =>
  unwrap(api.post('/auth/verify-otp', { email, otp, deviceId, termsVersion }, WAKE));
export const logoutSession = refreshToken => unwrap(api.post('/auth/logout', { refreshToken }));
export const getMe = () => unwrap(api.get('/me'));
export const updateMe = patch => unwrap(api.patch('/me', patch));
export const deleteMe = () => unwrap(api.delete('/me'));
