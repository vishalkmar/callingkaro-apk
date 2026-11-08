import api, { unwrap } from './client';

export const createOrder = (packageId, provider) => unwrap(api.post('/orders/create', { packageId, provider }));
export const verifyPlayPurchase = ({ orderId, productId, purchaseToken }) =>
  unwrap(api.post('/orders/verify-play', { orderId, productId, purchaseToken }));
export const verifyRazorpay = payload => unwrap(api.post('/orders/verify-razorpay', payload));
export const getOrder = orderId => unwrap(api.get(`/orders/${encodeURIComponent(orderId)}`));
