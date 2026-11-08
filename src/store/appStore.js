import { create } from 'zustand';

/**
 * Which top-level stack is shown. RootNavigator renders exactly one stack per stage,
 * so changing the stage behaves like navigation.reset (no way back to the previous stack).
 * stage: 'loading' | 'onboarding' | 'auth' | 'permissions' | 'main' | 'blocked'
 */
export const useAppStore = create(set => ({
  stage: 'loading',
  blockedReason: null,
  setStage: stage => set({ stage }),
  setBlocked: reason => set({ stage: 'blocked', blockedReason: reason || null }),
}));

export default useAppStore;
