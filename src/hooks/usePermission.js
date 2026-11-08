import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { check, request, openSettings, STATUS } from '@services/permissions/permissions';

/**
 * usePermission('contacts') -> { status, granted, blocked, request, openSettings, recheck }
 * Re-checks on screen focus and when the app returns from the background (user may have
 * changed it in system settings, or a one-time grant expired).
 */
export const usePermission = name => {
  const [status, setStatus] = useState(null);

  const recheck = useCallback(async () => {
    const s = await check(name);
    setStatus(s);
    return s;
  }, [name]);

  useFocusEffect(
    useCallback(() => {
      recheck();
    }, [recheck]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        recheck();
      }
    });
    return () => sub.remove();
  }, [recheck]);

  const ask = useCallback(async () => {
    const s = await request(name);
    setStatus(s);
    return s;
  }, [name]);

  return {
    status,
    granted: status === STATUS.GRANTED,
    blocked: status === STATUS.BLOCKED,
    loading: status === null,
    request: ask,
    openSettings,
    recheck,
  };
};

export default usePermission;
