import {
  ErrorCode,
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'react-native-iap';
import { createOrder, verifyPlayPurchase } from '@services/api/ordersApi';
import { useWalletStore } from '@store/walletStore';
import logger from '@utils/logger';

const log = logger.scope('payments');

/**
 * Google Play Billing (default channel - Play policy requires it for in-app digital credits).
 * The app NEVER adds credits itself: it sends the purchaseToken to the server, the server asks
 * Google, credits the wallet, and returns the new balance.
 */
let connected = null;
let listeners = [];
const waiters = new Map(); // productId -> { resolve, reject, orderId }

const verifyAndFinish = async (purchase, orderId) => {
  const token = purchase.purchaseToken || purchase.purchaseTokenAndroid;
  const res = await verifyPlayPurchase({ orderId, productId: purchase.productId, purchaseToken: token });
  // Consumable: finish so the same pack can be bought again (server also consumes).
  await finishTransaction({ purchase, isConsumable: true }).catch(e => log.warn('finishTransaction', e?.message));
  if (typeof res?.balance === 'number') {
    useWalletStore.getState().setBalance(res.balance);
  }
  return res;
};

export const initPayments = async () => {
  if (connected) {
    return connected;
  }
  connected = (async () => {
    try {
      await initConnection();
      listeners.push(
        purchaseUpdatedListener(async purchase => {
          const w = waiters.get(purchase.productId);
          try {
            const res = await verifyAndFinish(purchase, w?.orderId);
            w?.resolve(res);
          } catch (e) {
            log.warn('verify failed', e?.code);
            w?.reject(e);
          } finally {
            waiters.delete(purchase.productId);
          }
        }),
        purchaseErrorListener(err => {
          for (const [, w] of waiters) {
            w.reject(
              Object.assign(new Error(err?.message || 'Payment failed'), {
                code: err?.code === ErrorCode.UserCancelled ? 'CANCELLED' : 'PAYMENT_FAILED',
              }),
            );
          }
          waiters.clear();
        }),
      );
      await restorePending();
      return true;
    } catch (e) {
      log.warn('billing unavailable', e?.message);
      connected = null;
      return false;
    }
  })();
  return connected;
};

/** On start: any purchase that was paid but never verified/consumed (app killed, no network) is synced now. */
export const restorePending = async () => {
  try {
    const purchases = await getAvailablePurchases();
    for (const p of purchases || []) {
      await verifyAndFinish(p).catch(e => log.warn('restore verify failed', e?.code));
    }
  } catch (e) {
    log.warn('restore failed', e?.message);
  }
};

/**
 * Buy a package. Resolves with { order, balance } after SERVER verification.
 * Rejects with code CANCELLED | PAYMENT_PENDING | PAYMENT_FAILED | BILLING_UNAVAILABLE.
 */
export const buyPackage = async pkg => {
  const ok = await initPayments();
  if (!ok) {
    throw Object.assign(new Error('Google Play Billing is not available on this device'), {
      code: 'BILLING_UNAVAILABLE',
    });
  }
  const { order, accountTag } = await createOrder(pkg.id, 'play');
  await fetchProducts({ skus: [pkg.id], type: 'in-app' });
  const done = new Promise((resolve, reject) => waiters.set(pkg.id, { resolve, reject, orderId: order.id }));
  // accountTag ties the Google purchase to this account; the server checks it when verifying.
  try {
    await requestPurchase({
      request: { google: { skus: [pkg.id], ...(accountTag ? { obfuscatedAccountId: accountTag } : {}) } },
      type: 'in-app',
    });
  } catch (err) {
    // The Play sheet itself failed or was closed: no charge happened.
    waiters.delete(pkg.id);
    throw Object.assign(new Error(err?.message || 'Payment failed'), {
      code: err?.code === ErrorCode.UserCancelled ? 'CANCELLED' : 'PAYMENT_FAILED',
    });
  }
  return done;
};

export const closePayments = async () => {
  listeners.forEach(l => l?.remove?.());
  listeners = [];
  connected = null;
  await endConnection().catch(() => {});
};
