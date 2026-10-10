const { orderPublicView, courierJobView } = require('../services/serialize');
const { ADDRESS_VISIBLE } = require('../services/status');

let io = null;

const setIo = (instance) => { io = instance; };
const getIo = () => io;

const orderRoom = (orderId) => `order:${orderId}`;
const userRoom = (userId) => `user:${userId}`;
const restaurantRoom = (restaurantId) => `restaurant:${restaurantId}`;
const COURIER_POOL_ROOM = 'couriers:pool';
const ADMIN_ROOM = 'role:admin';

const hasIo = () => Boolean(io);

function emitToRoom(room, event, payload) {
  if (!hasIo()) return;
  io.to(room).emit(event, payload);
}

/**
 * Publish the authoritative order to everyone who cares. One event name per
 * audience, because a socket can belong to several of these rooms at once: the
 * `order:update` a kitchen sees on a detail view and the `restaurant:order` that
 * keeps its queue alive are deliberately different events, so no client ever has
 * to dedupe the same transition arriving twice. The room payload is the sanitised
 * view — the courier's address+phone go only to that courier's personal room.
 */
async function publishOrder(order, { courier, restaurant } = {}) {
  if (!hasIo() || !order) return;
  const publicView = orderPublicView(order);
  io.to(orderRoom(order._id)).emit('order:update', publicView);
  io.to(restaurantRoom(order.restaurantId?._id || order.restaurantId)).emit('restaurant:order', publicView);
  io.to(ADMIN_ROOM).emit('admin:order', publicView);

  const courierUserId = order.courierUserId || order.courierId?.userId;
  if (courierUserId && ADDRESS_VISIBLE.includes(order.status)) {
    io.to(userRoom(courierUserId)).emit('courier:job', courierJobView(order, courier, restaurant));
  } else if (courierUserId) {
    // Order closed: withdraw the PII-carrying job rather than leaving it on screen.
    io.to(userRoom(courierUserId)).emit('courier:job:closed', { orderId: String(order._id) });
  }
}

function notifyRestaurant(restaurantId, event, payload) {
  emitToRoom(restaurantRoom(restaurantId), event, payload);
}

function notifyAdmin(event, payload) {
  emitToRoom(ADMIN_ROOM, event, payload);
}

function isRoomLive(room) {
  if (!hasIo()) return false;
  const nodes = io.sockets.adapter.rooms.get(room);
  return Boolean(nodes && nodes.size);
}

module.exports = {
  setIo,
  getIo,
  orderRoom,
  userRoom,
  restaurantRoom,
  COURIER_POOL_ROOM,
  ADMIN_ROOM,
  emitToRoom,
  publishOrder,
  notifyRestaurant,
  notifyAdmin,
  isRoomLive
};
