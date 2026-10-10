const { Server } = require('socket.io');
const env = require('../config/env');
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Courier = require('../models/Courier');
const Restaurant = require('../models/Restaurant');
const bus = require('./bus');
const { orderPublicView } = require('../services/serialize');
const { distanceMeters } = require('../services/geo');
const { ACTIVE_FOR_COURIER } = require('../services/status');

/** Room membership is authorised here: a token alone does not entitle you to an order room. */
function mayViewOrder(user, order, courier, restaurant) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return String(order.customerId) === String(user._id);
  if (user.role === 'restaurant') return restaurant && String(restaurant.ownerId) === String(user._id);
  if (user.role === 'courier') return order.courierUserId && String(order.courierUserId) === String(user._id);
  return false;
}

function initRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin.includes('*') ? true : env.corsOrigin, credentials: true },
    serveClient: false,
    pingInterval: 20000,
    pingTimeout: 25000
  });
  bus.setIo(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || String(socket.handshake.query?.token || '');
      if (!token) return next(new Error('UNAUTHENTICATED'));
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub);
      if (!user || user.isBlocked) return next(new Error('UNAUTHENTICATED'));
      socket.data.user = { id: String(user._id), role: user.role, name: user.name };
      next();
    } catch (err) {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', async (socket) => {
    const actor = socket.data.user;
    socket.join(bus.userRoom(actor.id));
    if (actor.role === 'admin') socket.join(bus.ADMIN_ROOM);

    if (actor.role === 'courier') {
      const courier = await Courier.findOne({ userId: actor.id });
      if (courier) {
        socket.data.courierId = String(courier._id);
        socket.join(bus.COURIER_POOL_ROOM);
      }
    }
    if (actor.role === 'restaurant') {
      const restaurant = await Restaurant.findOne({ ownerId: actor.id });
      if (restaurant) socket.data.restaurantId = String(restaurant._id);
      socket.join(bus.restaurantRoom(socket.data.restaurantId || 'none'));
    }

    socket.emit('realtime:ready', { userId: actor.id, role: actor.role, at: new Date().toISOString() });

    socket.on('order:join', async ({ orderId } = {}, ack) => {
      try {
        const order = await Order.findById(orderId);
        if (!order) throw new Error('ORDER_NOT_FOUND');
        const [courier, restaurant] = await Promise.all([
          order.courierId ? Courier.findById(order.courierId) : null,
          Restaurant.findById(order.restaurantId)
        ]);
        if (!mayViewOrder({ _id: actor.id, role: actor.role }, order, courier, restaurant)) {
          throw new Error('NOT_ORDER_PARTICIPANT');
        }
        socket.join(bus.orderRoom(orderId));
        const payload = orderPublicView(order);
        if (courier?.lastKnownLocation?.coordinates) {
          const [lng, lat] = courier.lastKnownLocation.coordinates;
          payload.courierLocation = { lat, lng, at: courier.locationUpdatedAt };
        }
        if (typeof ack === 'function') ack({ ok: true, order: payload });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('order:leave', ({ orderId } = {}) => {
      if (orderId) socket.leave(bus.orderRoom(orderId));
    });

    socket.on('courier:online', async ({ isOnline } = {}, ack) => {
      if (actor.role !== 'courier') return ack?.({ ok: false, error: 'ROLE_NOT_ALLOWED' });
      const courier = await Courier.findById(socket.data.courierId);
      if (!courier) return ack?.({ ok: false, error: 'NO_COURIER_PROFILE' });
      courier.isOnline = Boolean(isOnline);
      await courier.save();
      const view = { id: String(courier._id), isOnline: courier.isOnline, activeOrders: courier.activeOrders };
      bus.emitToRoom(bus.COURIER_POOL_ROOM, 'courier:presence', view);
      bus.notifyAdmin('courier:presence', view);
      ack?.({ ok: true, isOnline: courier.isOnline });
    });

    socket.on('courier:location', async (payload = {}) => {
      if (actor.role !== 'courier') return;
      const lat = Number(payload.lat);
      const lng = Number(payload.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const now = Date.now();
      const last = socket.data.lastLocationAt || 0;
      // The throttle is for the automatic stream; an explicit "I am here" tap must land.
      if (!payload.force && now - last < env.locationThrottleMs) return; // throttle, do not queue
      socket.data.lastLocationAt = now;

      const courier = await Courier.findById(socket.data.courierId);
      if (!courier) return;
      courier.lastKnownLocation = { type: 'Point', coordinates: [lng, lat] };
      courier.locationUpdatedAt = new Date();
      await courier.save();

      const open = await Order.find({ courierId: courier._id, status: { $in: ACTIVE_FOR_COURIER } });
      const update = { courierId: String(courier._id), lat, lng, at: courier.locationUpdatedAt };
      for (const order of open) {
        bus.emitToRoom(bus.orderRoom(order._id), 'courier:location', {
          ...update,
          restaurantLocation: undefined
        });
        if (order.restaurantId) {
          const restaurant = await Restaurant.findById(order.restaurantId).select('location').lean();
          if (restaurant) {
            const [rlng, rlat] = restaurant.location.coordinates;
            const meters = distanceMeters({ lat, lng }, { lat: rlat, lng: rlng });
            bus.emitToRoom(bus.orderRoom(order._id), 'courier:distance', { orderId: String(order._id), distanceMeters: meters });
          }
        }
      }
      bus.notifyAdmin('courier:location', { ...update, isOnline: courier.isOnline });
    });

    socket.on('courier:offer:respond', async ({ orderId, decision } = {}, ack) => {
      if (actor.role !== 'courier') return ack?.({ ok: false, error: 'ROLE_NOT_ALLOWED' });
      const assignment = require('../services/assignment');
      const result = await assignment.respondToOffer({
        orderId,
        decision: decision === 'accept' ? 'accept' : 'decline',
        courierId: socket.data.courierId,
        userId: actor.id
      });
      ack?.(result);
    });
  });

  return io;
}

module.exports = { initRealtime, mayViewOrder };
