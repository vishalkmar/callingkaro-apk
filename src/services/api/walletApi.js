import api, { unwrap } from './client';

export const getWallet = () => unwrap(api.get('/wallet'));
export const getLedger = (page = 1) => unwrap(api.get('/wallet/ledger', { params: { page } }));
export const getWalletConfig = () => unwrap(api.get('/wallet/config'));
export const claimCheckin = () => unwrap(api.post('/wallet/checkin'));
