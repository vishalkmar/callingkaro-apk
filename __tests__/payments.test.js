// Phase 19 app side: Play Billing flow against a scriptable fake of react-native-iap.
jest.mock('react-native-iap', () => {
  const state = { updated: null, error: null };
  return {
    __state: state,
    ErrorCode: { UserCancelled: 'user-cancelled' },
    initConnection: jest.fn(async () => true),
    endConnection: jest.fn(async () => {}),
    fetchProducts: jest.fn(async () => []),
    getAvailablePurchases: jest.fn(async () => []),
    finishTransaction: jest.fn(async () => {}),
    requestPurchase: jest.fn(async () => {}),
    purchaseUpdatedListener: jest.fn(fn => {
      state.updated = fn;
      return { remove: jest.fn() };
    }),
    purchaseErrorListener: jest.fn(fn => {
      state.error = fn;
      return { remove: jest.fn() };
    }),
  };
});
jest.mock('@services/api/ordersApi', () => ({
  createOrder: jest.fn(async packageId => ({ order: { id: 'order-1', packageId }, accountTag: 'tag-abc' })),
  verifyPlayPurchase: jest.fn(),
}));

const iap = require('react-native-iap');
const ordersApi = require('@services/api/ordersApi');
let payments;
let useWalletStore;
// Fresh module state per test; the wallet store must come from the same isolated registry.
const load = () => {
  jest.isolateModules(() => {
    payments = require('@services/payments/payments');
    ({ useWalletStore } = require('@store/walletStore'));
  });
};
const PKG = { id: 'minutes_80', minutes: 80, priceInr: 100 };
const purchase = (over = {}) => ({ productId: 'minutes_80', purchaseToken: 'tok-1', ...over });
const tick = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  jest.clearAllMocks();
  load();
  useWalletStore.setState({ credits: 0 });
});

describe('Play Billing (P19 app side)', () => {
  test('buy: server order -> Play sheet with accountTag -> server verifies -> transaction finished -> balance', async () => {
    ordersApi.verifyPlayPurchase.mockResolvedValueOnce({ order: { id: 'order-1', status: 'paid' }, balance: 80000 });
    const p = payments.buyPackage(PKG);
    await tick();
    await tick();
    expect(iap.requestPurchase).toHaveBeenCalledWith({
      request: { google: { skus: ['minutes_80'], obfuscatedAccountId: 'tag-abc' } },
      type: 'in-app',
    });
    await iap.__state.updated(purchase());
    const r = await p;
    expect(ordersApi.verifyPlayPurchase).toHaveBeenCalledWith({
      orderId: 'order-1',
      productId: 'minutes_80',
      purchaseToken: 'tok-1',
    });
    expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase: purchase(), isConsumable: true });
    expect(r.balance).toBe(80000);
    expect(useWalletStore.getState().credits).toBe(80000);
  });

  test('P19.T17 server refuses -> nothing added, transaction NOT finished (Play keeps it for retry)', async () => {
    ordersApi.verifyPlayPurchase.mockRejectedValueOnce(
      Object.assign(new Error('bad'), { code: 'PAYMENT_VERIFICATION_FAILED' }),
    );
    const p = payments.buyPackage(PKG);
    await tick();
    await tick();
    await iap.__state.updated(purchase());
    await expect(p).rejects.toMatchObject({ code: 'PAYMENT_VERIFICATION_FAILED' });
    expect(iap.finishTransaction).not.toHaveBeenCalled();
    expect(useWalletStore.getState().credits).toBe(0);
  });

  test('pending payment (UPI / bank) -> PAYMENT_PENDING, not finished', async () => {
    ordersApi.verifyPlayPurchase.mockRejectedValueOnce(
      Object.assign(new Error('pending'), { code: 'PAYMENT_PENDING' }),
    );
    const p = payments.buyPackage(PKG);
    await tick();
    await tick();
    await iap.__state.updated(purchase());
    await expect(p).rejects.toMatchObject({ code: 'PAYMENT_PENDING' });
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  test('user closes the Play sheet (listener path) -> CANCELLED', async () => {
    const p = payments.buyPackage(PKG);
    await tick();
    await tick();
    iap.__state.error({ code: 'user-cancelled', message: 'cancelled' });
    await expect(p).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  test('BUG FIX: requestPurchase itself rejects with cancel -> CANCELLED (was shown as "payment failed")', async () => {
    iap.requestPurchase.mockRejectedValueOnce({ code: 'user-cancelled', message: 'User cancelled' });
    await expect(payments.buyPackage(PKG)).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  test('billing not available on the phone -> BILLING_UNAVAILABLE, no order created', async () => {
    iap.initConnection.mockRejectedValueOnce(new Error('no play store'));
    await expect(payments.buyPackage(PKG)).rejects.toMatchObject({ code: 'BILLING_UNAVAILABLE' });
    expect(ordersApi.createOrder).not.toHaveBeenCalled();
  });

  test('P19.T14 on start, paid-but-unverified purchases are sent to the server and finished', async () => {
    iap.getAvailablePurchases.mockResolvedValueOnce([purchase({ purchaseToken: 'left-over' })]);
    ordersApi.verifyPlayPurchase.mockResolvedValueOnce({ balance: 80000 });
    expect(await payments.initPayments()).toBe(true);
    expect(ordersApi.verifyPlayPurchase).toHaveBeenCalledWith({
      orderId: undefined,
      productId: 'minutes_80',
      purchaseToken: 'left-over',
    });
    expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(useWalletStore.getState().credits).toBe(80000);
  });
});

describe('purchase dialog flow (P19.T11-T13)', () => {
  const React = require('react');
  const { render, act } = require('@testing-library/react-native');

  const realPayments = require('@services/payments/payments');
  const { usePurchaseFlow } = require('@screens/wallet/usePurchaseFlow');

  const run = async outcome => {
    jest.spyOn(realPayments, 'buyPackage').mockImplementation(outcome);
    let flow;
    const Probe = () => {
      flow = usePurchaseFlow();
      return null;
    };
    render(React.createElement(Probe));
    act(() => flow.ask(PKG));
    expect(flow.step).toBe('confirm');
    await act(async () => flow.confirm());
    return flow;
  };

  test('success', async () => {
    expect((await run(async () => ({ balance: 80000 }))).step).toBe('success');
  });
  test('cancel closes quietly', async () => {
    expect((await run(async () => Promise.reject(Object.assign(new Error('c'), { code: 'CANCELLED' })))).step).toBe(
      'idle',
    );
  });
  test('pending', async () => {
    expect(
      (await run(async () => Promise.reject(Object.assign(new Error('p'), { code: 'PAYMENT_PENDING' })))).step,
    ).toBe('pending');
  });
  test('failed (with retry)', async () => {
    const f = await run(async () => Promise.reject(Object.assign(new Error('x'), { code: 'PAYMENT_FAILED' })));
    expect(f.step).toBe('failed');
    expect(typeof f.retry).toBe('function');
  });
});
