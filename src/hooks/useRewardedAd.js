import { useCallback, useState } from 'react';
import { toast } from '@components/common';
import { showRewarded } from '@services/ads/rewardedAd';

const MESSAGES = {
  closed_early: ['Watch the full video to earn credits', 'Rewards are given only for complete videos.'],
  no_fill: ['No ads right now, try later', 'Please check again in a few minutes.'],
  no_consent: ['Ads are off', 'You can change your ad choices in Settings > Ad privacy choices.'],
  in_call: ['Ads are paused during calls', null],
  limit: ["You reached today's limit", 'Come back tomorrow for more rewards.'],
  disabled: ['Rewards unavailable', 'Free rewards are not available on this device.'],
  pending: ['Reward is on its way', 'Google is confirming your reward - your balance updates in a moment.'],
};

/** Shows a rewarded ad and turns the result into user messages. Returns { watch, busy }. */
export const useRewardedAd = ({ onRewarded } = {}) => {
  const [busy, setBusy] = useState(false);
  const watch = useCallback(
    async (purpose = 'credits') => {
      if (busy) {
        return null;
      }
      setBusy(true);
      try {
        const r = await showRewarded(purpose);
        if (r.status === 'rewarded') {
          onRewarded?.(r, purpose);
        } else if (MESSAGES[r.status]) {
          const [title, msg] = MESSAGES[r.status];
          (r.status === 'pending' ? toast.info : toast.error)(title, r.message || msg || undefined);
        }
        return r;
      } finally {
        setBusy(false);
      }
    },
    [busy, onRewarded],
  );
  return { watch, busy };
};

export default useRewardedAd;
