import api, { unwrap } from './client';

// Returns { nonce, customData, todayCount, max } - customData is passed to AdMob SSV.
export const createAdSession = purpose => unwrap(api.post('/ads/session', { purpose }));
export const getAdStatus = () => unwrap(api.get('/ads/status'));
