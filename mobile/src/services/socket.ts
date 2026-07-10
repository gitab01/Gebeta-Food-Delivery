import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { store } from '../store';
import { updateDriverLocation, updateOrderStatus } from '../store/slices/orderSlice';

const SOCKET_URL = Constants.expoConfig?.extra?.SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const connectSocket = async () => {
  const token = await AsyncStorage.getItem('accessToken');
  if (!token) return;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  // Listen for order status changes
  socket.on('order:status_change', (data) => {
    console.log('📦 Order status change:', data);
    store.dispatch(updateOrderStatus({ orderId: data.orderId, status: data.status }));
  });

  // Listen for driver location updates
  socket.on('order:location_update', (data) => {
    store.dispatch(updateDriverLocation(data.location));
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const trackOrder = (orderId: string) => {
  socket?.emit('order:track', { orderId });
};

export const untrackOrder = (orderId: string) => {
  socket?.emit('order:untrack', { orderId });
};

// Driver-specific
export const updateDriverLocationSocket = (lat: number, lng: number, orderId?: string) => {
  socket?.emit('driver:location', { lat, lng, orderId });
};

export const setDriverAvailability = (isAvailable: boolean) => {
  socket?.emit('driver:availability', { isAvailable });
};
