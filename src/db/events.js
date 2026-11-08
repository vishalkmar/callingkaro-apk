// Minimal event emitter so screens refresh when local data changes (e.g. a call ends).
const listeners = new Map();

export const DB_EVENTS = {
  CALL_LOGS: 'call_logs:changed',
  CONTACTS: 'contacts:changed',
  FAVORITES: 'favorites:changed',
  RECORDINGS: 'recordings:changed',
};

export const on = (event, fn) => {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
};

export const emit = (event, payload) => {
  for (const fn of listeners.get(event) || []) {
    try {
      fn(payload);
    } catch (e) {
      // a broken listener must not break the writer
    }
  }
};

export default { on, emit, DB_EVENTS };
