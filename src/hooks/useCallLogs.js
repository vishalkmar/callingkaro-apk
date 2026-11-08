import { useCallback, useEffect, useRef, useState } from 'react';
import * as callLogRepo from '@db/callLogRepo';
import { on, DB_EVENTS } from '@db/events';

const PAGE = 30;

/**
 * Paginated call history that refreshes itself whenever call_logs change (e.g. a call ends).
 * filter: 'all' | 'connected' | 'notConnected'
 */
export const useCallLogs = (filter = 'all') => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const reload = useCallback(async () => {
    // Keep everything the user already scrolled through (+ room for new calls at the top),
    // otherwise a new call would push the oldest loaded row out of the list.
    const size = (offsetRef.current || 0) + PAGE;
    const rows = await callLogRepo.listRecent({ limit: size, offset: 0, filter });
    offsetRef.current = rows.length;
    setItems(rows);
    setHasMore(rows.length >= size);
    setLoading(false);
  }, [filter]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return;
    }
    setLoadingMore(true);
    const rows = await callLogRepo.listRecent({ limit: PAGE, offset: offsetRef.current, filter });
    offsetRef.current += rows.length;
    setItems(prev => [...prev, ...rows]);
    setHasMore(rows.length === PAGE);
    setLoadingMore(false);
  }, [filter, hasMore, loadingMore]);

  useEffect(() => {
    offsetRef.current = 0;
    setLoading(true);
    reload();
    return on(DB_EVENTS.CALL_LOGS, () => reload());
  }, [reload]);

  return { items, loading, loadingMore, hasMore, loadMore, reload, setItems };
};

export default useCallLogs;
