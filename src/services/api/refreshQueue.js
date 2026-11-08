/**
 * Single-flight token refresh. While one refresh is running, every other caller
 * waits on the same promise, so parallel 401s trigger only ONE /auth/refresh call.
 */
export const createRefreshQueue = refreshFn => {
  let inFlight = null;
  return {
    refresh() {
      if (!inFlight) {
        inFlight = Promise.resolve()
          .then(refreshFn)
          .finally(() => {
            inFlight = null;
          });
      }
      return inFlight;
    },
    isRefreshing: () => inFlight !== null,
  };
};

export default createRefreshQueue;
