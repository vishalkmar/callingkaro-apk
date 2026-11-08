import { create } from 'zustand';

/**
 * status: 'unknown' | 'authenticated' | 'guest' | 'blocked'
 * Tokens are NOT kept here (they live in Keychain via secureStore) - only a flag.
 */
export const useAuthStore = create(set => ({
  user: null,
  status: 'unknown',
  hasTokens: false,
  login: ({ user }) => set({ user, status: 'authenticated', hasTokens: true }),
  setUser: user => set(s => ({ user: { ...(s.user || {}), ...user } })),
  setBlocked: () => set({ status: 'blocked' }),
  logout: () => set({ user: null, status: 'guest', hasTokens: false }),
}));

export default useAuthStore;
