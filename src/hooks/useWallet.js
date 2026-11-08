import { useWalletStore } from '@store/walletStore';
import { CONFIG } from '@constants/config';

export const useWallet = () => {
  const credits = useWalletStore(s => s.credits);
  const minutes = useWalletStore(s => s.minutes);
  const lastSyncedAt = useWalletStore(s => s.lastSyncedAt);
  const loading = useWalletStore(s => s.loading);
  const refresh = useWalletStore(s => s.refresh);
  return {
    credits,
    minutes,
    lastSyncedAt,
    loading,
    refresh,
    canCall: credits >= CONFIG.MIN_CREDITS_TO_CALL,
  };
};

export default useWallet;
