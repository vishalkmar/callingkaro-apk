import { create } from 'zustand';

/**
 * Live call state. status: idle | connecting | ringing | connected | reconnecting | ending | ended
 * activeCall: { localId, number, name, callSid, maxSeconds, startedAt, answeredAt }
 */
const INITIAL = {
  activeCall: null,
  status: 'idle',
  startedAt: null,
  answeredAt: null,
  isMuted: false,
  isOnHold: false,
  isSpeaker: false,
  isRecording: false,
  audioRoute: 'earpiece',
  audioRoutes: [],
  endReason: null,
  error: null,
  summary: null,
  dtmf: '',
};

export const useCallStore = create(set => ({
  ...INITIAL,
  begin: call => set({ ...INITIAL, activeCall: call, status: 'connecting', startedAt: Date.now() }),
  patchCall: patch => set(s => ({ activeCall: s.activeCall ? { ...s.activeCall, ...patch } : s.activeCall })),
  setStatus: status => set({ status }),
  setConnected: () => set({ status: 'connected', answeredAt: Date.now() }),
  set: patch => set(patch),
  appendDtmf: d => set(s => ({ dtmf: (s.dtmf + d).slice(-24) })),
  finish: ({ endReason, error, summary } = {}) =>
    set({ status: 'ended', endReason: endReason || null, error: error || null, summary: summary || null }),
  clear: () => set({ ...INITIAL }),
}));

export const isCallActive = () => {
  const s = useCallStore.getState();
  return !!s.activeCall && s.status !== 'ended' && s.status !== 'idle';
};

export default useCallStore;
