import api, { unwrap } from './client';

export const submitReport = ({ targetNumber, reason, details, callSid }) =>
  unwrap(api.post('/report', { targetNumber, reason, details, callSid }));
