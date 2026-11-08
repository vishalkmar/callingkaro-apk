import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@constants/config';

export const DEFAULT_SETTINGS = {
  recordAllCalls: false,
  speakerDefault: false,
  vibrateOnConnect: true,
  keypadTones: true,
  haptics: true,
  theme: 'light',
  language: 'en',
};

// Persisted to AsyncStorage (non-sensitive preferences only).
export const useSettingsStore = create(
  persist(
    set => ({
      ...DEFAULT_SETTINGS,
      setSetting: (key, value) => set({ [key]: value }),
      resetSettings: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: STORAGE_KEYS.SETTINGS,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: s => {
        const { setSetting, resetSettings, ...rest } = s;
        return rest;
      },
    },
  ),
);

export default useSettingsStore;
