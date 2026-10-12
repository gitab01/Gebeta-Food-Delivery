/**
 * One API client for both apps. The backend is the only place order state is
 * decided, so screens never patch a status locally — they render what the socket
 * confirms.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { io } from 'socket.io-client';

const stored = process.env.EXPO_PUBLIC_API_URL;

/**
 * On a real device the phone reaches the machine running Metro through the host
 * LAN address Expo already tells us, so the API host is derived from it instead of
 * asking anyone to type an IP.
 */
export function apiBaseUrl() {
  if (stored) return stored.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debugHost || '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:4000`;
  return 'http://127.0.0.1:4000';
}

export const WS_URL = apiBaseUrl();

let token = null;
export const setToken = (value) => {
  token = value;
};

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth && token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${apiBaseUrl()}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Request failed (${res.status})`);
    err.code = json?.error?.code;
    err.status = res.status;
    err.detail = json?.error?.detail;
    throw err;
  }
  return json;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/auth/me'),
  addAddress: (payload) => request('/auth/me/addresses', { method: 'POST', body: payload }),
  removeAddress: (addressId) => request(`/auth/me/addresses/${addressId}`, { method: 'DELETE' }),
  addPaymentMethod: (payload) => request('/auth/me/payment-methods', { method: 'POST', body: payload }),
  setDefaultPaymentMethod: (methodId) => request(`/auth/me/payment-methods/${methodId}/default`, { method: 'PATCH' }),
  removePaymentMethod: (methodId) => request(`/auth/me/payment-methods/${methodId}`, { method: 'DELETE' }),

  restaurants: (lat, lng) => request(`/restaurants?lat=${lat}&lng=${lng}`),
  restaurant: (id, lat, lng) =>
    request(`/restaurants/${id}${Number.isFinite(lat) ? `?lat=${lat}&lng=${lng}` : ''}`),
  live: () => request('/restaurants/meta/live'),

  createOrder: (payload) => request('/orders', { method: 'POST', body: payload }),
  myOrders: (scope = 'mine') => request(`/orders?scope=${scope}`),
  order: (id) => request(`/orders/${id}`),
  cancel: (id, reason) => request(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
  rate: (id, payload) => request(`/orders/${id}/rate`, { method: 'POST', body: payload }),

  paymentIntent: (orderId) => request('/payments/intent', { method: 'POST', body: { orderId } }),
  confirmMockPayment: (paymentId) =>
    request('/payments/mock/confirm', { method: 'POST', body: { paymentId } }),

  courierMe: () => request('/courier/me'),
  courierJobs: (scope = 'active') => request(`/courier/jobs?scope=${scope}`),
  courierOnline: (isOnline) => request('/courier/online', { method: 'POST', body: { isOnline } }),
  courierLocation: (lat, lng) => request('/courier/location', { method: 'POST', body: { lat, lng } }),
  courierPickup: (id) => request(`/courier/jobs/${id}/pickup`, { method: 'POST' }),
  courierDeliver: (id) => request(`/courier/jobs/${id}/deliver`, { method: 'POST' }),
  courierEarnings: () => request('/courier/earnings'),
  courierVehicle: (payload) => request('/courier/vehicle', { method: 'PATCH', body: payload })
};

let socket = null;

/** One shared socket per app: reconnecting clients re-join their rooms on 'connect'. */
export function realtime() {
  if (!socket) {
    socket = io(WS_URL, {
      transports: Platform.OS === 'web' ? ['websocket', 'polling'] : ['websocket'],
      auth: { token },
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000
    });
  } else if (socket.auth?.token !== token) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
  return socket;
}

/** Signing out must end the live connection, not just the token. */
export function closeRealtime() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export const etb = (cents) => `${((cents || 0) / 100).toFixed(2)} ETB`;

export const km = (meters) =>
  meters == null ? null : meters < 950 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
