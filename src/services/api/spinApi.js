import api, { unwrap } from './client';

export const getSpinStatus = () => unwrap(api.get('/spin/status'));
// The app never sends an amount: the server picks the segment and credits the wallet.
export const playSpin = () => unwrap(api.post('/spin/play'));
