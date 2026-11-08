import api, { unwrap } from './client';

export const getVoiceToken = () => unwrap(api.get('/voice/token'));
export const startRecording = callSid => unwrap(api.post('/voice/recording/start', { callSid }));
export const stopRecording = callSid => unwrap(api.post('/voice/recording/stop', { callSid }));
export const getRecordingUrl = callSid => unwrap(api.get(`/recordings/${encodeURIComponent(callSid)}/url`));
export const listCalls = (page = 1) => unwrap(api.get('/calls', { params: { page } }));
export const getCall = callSid => unwrap(api.get(`/calls/${encodeURIComponent(callSid)}`));
