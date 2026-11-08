import { create } from 'zustand';

// Which pre-call dialog is open: null | 'credits' | 'mic' | 'emergency' | 'unavailable'
export const useCallGateStore = create(set => ({
  dialog: null,
  pending: null, // { number, name } waiting for mic permission
  open: (dialog, pending = null) => set({ dialog, pending }),
  close: () => set({ dialog: null, pending: null }),
}));

export default useCallGateStore;
