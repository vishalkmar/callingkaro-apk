import { create } from 'zustand';
import { creditsToMinutes } from '@utils/format';
import { getWallet, getWalletConfig } from '@services/api/walletApi';
import logger from '@utils/logger';

// Cached copy of the server wallet. The server is the money truth; the app never edits credits locally.
export const useWalletStore = create((set, get) => ({
  credits: 0,
  minutes: 0,
  lastEntries: [],
  lastSyncedAt: null,
  config: null,
  loading: false,
  error: null,

  setFromServer: data => {
    if (!data || typeof data.credits !== 'number') {
      return;
    }
    set({
      credits: data.credits,
      minutes: creditsToMinutes(data.credits),
      lastEntries: data.lastEntries || get().lastEntries,
      lastSyncedAt: Date.now(),
    });
  },

  // Called with the `balance` returned by reward / purchase / spin endpoints.
  setBalance: credits => {
    if (typeof credits === 'number') {
      set({ credits, minutes: creditsToMinutes(credits), lastSyncedAt: Date.now() });
    }
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const data = await getWallet();
      get().setFromServer(data);
      set({ loading: false });
      return data;
    } catch (e) {
      logger.warn('wallet refresh failed', e?.code);
      set({ loading: false, error: e });
      return null;
    }
  },

  loadConfig: async () => {
    try {
      const config = await getWalletConfig();
      set({ config });
      return config;
    } catch (e) {
      set({ error: e });
      throw e;
    }
  },

  reset: () => set({ credits: 0, minutes: 0, lastEntries: [], lastSyncedAt: null, config: null, error: null }),
}));

export default useWalletStore;
