import { io } from 'socket.io-client';

const RAW = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000';
export const API_URL = RAW.replace(/\/$/, '');

const KEY = 'gebeta.admin.session';

export function readSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function writeSession(value) {
  if (value) localStorage.setItem(KEY, JSON.stringify(value));
  else localStorage.removeItem(KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const session = readSession();
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(session?.token ? { authorization: `Bearer ${session.token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Request failed (${res.status})`);
    err.code = json?.error?.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

export const api = {
  login: (phone, password) => request('/auth/login', { method: 'POST', body: { phone, password } }),
  me: () => request('/auth/me'),
  stats: () => request('/admin/stats'),
  orders: (query = '') => request(`/admin/orders${query}`),
  order: (id) => request(`/admin/orders/${id}`),
  transition: (id, to, note) => request(`/admin/orders/${id}/transition`, { method: 'POST', body: { to, note } }),
  reassign: (id) => request(`/admin/orders/${id}/reassign`, { method: 'POST' }),
  couriers: () => request('/admin/couriers'),
  restaurants: () => request('/admin/restaurants'),
  patchRestaurant: (id, body) => request(`/admin/restaurants/${id}`, { method: 'PATCH', body }),
  users: ({ role, q } = {}) => {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (q) params.set('q', q);
    const query = params.toString();
    return request(`/admin/users${query ? `?${query}` : ''}`);
  },
  setUserBlock: (id, isBlocked) => request(`/admin/users/${id}/block`, { method: 'POST', body: { isBlocked } }),
  sweep: () => request('/admin/watchdog/sweep', { method: 'POST' }),
  analytics: (days = 14) => request(`/admin/analytics?days=${days}`),
  settings: () => request('/admin/settings'),
  saveSettings: (patch) => request('/admin/settings', { method: 'PATCH', body: patch }),
  // The kitchen console signs in as a restaurant owner, not an operator.
  owner: {
    me: () => request('/restaurant-owner/me'),
    orders: (scope = 'live') => request(`/restaurant-owner/orders?scope=${scope}`),
    accept: (id) => request(`/restaurant-owner/orders/${id}/accept`, { method: 'POST' }),
    reject: (id, reason) => request(`/restaurant-owner/orders/${id}/reject`, { method: 'POST', body: { reason } }),
    ready: (id) => request(`/restaurant-owner/orders/${id}/ready`, { method: 'POST' }),
    setOpen: (isOpen) => request('/restaurant-owner/me/open', { method: 'PATCH', body: { isOpen } }),
    setItem: (itemId, body) => request(`/restaurant-owner/me/menu/items/${itemId}`, { method: 'PATCH', body })
  }
};

let socket = null;

/** The operator feed: one socket, the admin room, every event the dashboard draws. */
export function realtime() {
  const token = readSession()?.token;
  if (!socket) {
    socket = io(API_URL, { transports: ['websocket', 'polling'], auth: { token } });
  } else if (socket.auth?.token !== token) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
  return socket;
}

/** Signing out must end the live connection, not just forget the token. */
export function closeRealtime() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export const ORDER_FLOW = ['PLACED', 'PAID', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED'];
export const LABEL = {
  PLACED: 'Placed',
  PAID: 'Paid',
  PREPARING: 'Cooking',
  READY: 'Ready',
  ASSIGNED: 'Assigned',
  PICKED_UP: 'On the road',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled'
};

export const TERMINAL = ['COMPLETED', 'REJECTED', 'CANCELLED'];

export const money = (cents) => `${((cents || 0) / 100).toFixed(2)}`;

export const distance = (meters) =>
  meters == null ? '—' : meters < 950 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;

export const clock = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export const ageMinutes = (iso) => {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
};
