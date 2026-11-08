import { useCallback, useState } from 'react';
import { buyPackage } from '@services/payments/payments';
import logger from '@utils/logger';

/**
 * Buy flow state machine: idle -> confirm -> buying -> success | pending | failed.
 * Credits are only shown as added after the SERVER verified the purchase.
 */
export const usePurchaseFlow = () => {
  const [state, setState] = useState({ step: 'idle', pkg: null, error: null, result: null });

  const ask = useCallback(pkg => setState({ step: 'confirm', pkg, error: null, result: null }), []);
  const close = useCallback(() => setState({ step: 'idle', pkg: null, error: null, result: null }), []);

  const confirm = useCallback(async () => {
    const pkg = state.pkg;
    setState(s => ({ ...s, step: 'buying' }));
    try {
      const result = await buyPackage(pkg);
      setState({ step: 'success', pkg, error: null, result });
    } catch (e) {
      logger.warn('purchase failed', e?.code);
      if (e?.code === 'CANCELLED') {
        setState({ step: 'idle', pkg: null, error: null, result: null });
      } else if (e?.code === 'PAYMENT_PENDING') {
        setState({ step: 'pending', pkg, error: e, result: null });
      } else {
        setState({ step: 'failed', pkg, error: e, result: null });
      }
    }
  }, [state.pkg]);

  return { ...state, ask, confirm, close, retry: confirm };
};

export default usePurchaseFlow;
