const express = require('express');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { transition, refreshEta } = require('../services/orderService');
const assignment = require('../services/assignment');
const { orderPublicView, restaurantPublicView } = require('../services/serialize');
const { STATUS, ACTOR } = require('../services/status');
const bus = require('../realtime/bus');

const router = express.Router();
router.use(requireAuth, requireRole('restaurant'));

async function ownedRestaurant(user) {
  const restaurant = await Restaurant.findOne({ ownerId: user._id });
  if (!restaurant) throw Object.assign(new Error('No restaurant is linked to this account'), { status: 404 });
  return restaurant;
}

const QUEUE = {
  incoming: [STATUS.PAID],
  cooking: [STATUS.PREPARING],
  waiting: [STATUS.READY],
  live: [STATUS.PAID, STATUS.PREPARING, STATUS.READY, STATUS.ASSIGNED, STATUS.PICKED_UP]
};

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const restaurant = await ownedRestaurant(req.user);
    res.json({ restaurant: restaurantPublicView(restaurant) });
  })
);

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const restaurant = await ownedRestaurant(req.user);
    const statuses = QUEUE[req.query.scope] || QUEUE.live;
    const orders = await Order.find({ restaurantId: restaurant._id, status: { $in: statuses } })
      .sort({ placedAt: -1 })
      .limit(50)
      .populate('courierId', 'name vehicle');
    res.json({ orders: orders.map(orderPublicView), restaurantId: String(restaurant._id) });
  })
);

async function loadOrder(req, restaurantId) {
  const order = await Order.findById(req.params.id);
  if (!order || String(order.restaurantId) !== String(restaurantId)) {
    throw Object.assign(new Error('Order not found for this restaurant'), { status: 404 });
  }
  return order;
}

router.post(
  '/orders/:id/accept',
  asyncHandler(async (req, res) => {
    const restaurant = await ownedRestaurant(req.user);
    await loadOrder(req, restaurant._id);
    const { order } = await transition(req.params.id, {
      to: STATUS.PREPARING,
      actor: ACTOR.RESTAURANT,
      actorId: req.user._id,
      note: 'Kitchen accepted the order'
    });
    const opened = await assignment.openAssignment(order._id);
    res.json({ order: orderPublicView(await order.populate(['restaurantId', 'courierId'])), assignment: opened });
  })
);

router.post(
  '/orders/:id/reject',
  asyncHandler(async (req, res) => {
    const restaurant = await ownedRestaurant(req.user);
    await loadOrder(req, restaurant._id);
    const reason = (req.body && req.body.reason) || 'The kitchen could not take this order';
    const { order } = await transition(req.params.id, {
      to: STATUS.REJECTED,
      actor: ACTOR.RESTAURANT,
      actorId: req.user._id,
      note: reason
    });
    res.json({ order: orderPublicView(order), refundQueued: true });
  })
);

router.post(
  '/orders/:id/ready',
  asyncHandler(async (req, res) => {
    const restaurant = await ownedRestaurant(req.user);
    await loadOrder(req, restaurant._id);
    const { order } = await transition(req.params.id, {
      to: STATUS.READY,
      actor: ACTOR.RESTAURANT,
      actorId: req.user._id,
      note: req.body?.note || 'Food is ready for pickup'
    });
    await refreshEta(order._id, { force: true });
    res.json({ order: orderPublicView(await order.populate(['restaurantId', 'courierId'])) });
  })
);

/** Opening and closing the restaurant is a live event: carts and estimates depend on it. */
router.patch(
  '/me/open',
  asyncHandler(async (req, res) => {
    const restaurant = await ownedRestaurant(req.user);
    restaurant.isOpen = Boolean(req.body?.isOpen);
    await restaurant.save();
    const view = restaurantPublicView(restaurant);
    bus.notifyAdmin('restaurant:availability', { id: view.id, name: view.name, isOpen: view.isOpen });
    res.json({ restaurant: view });
  })
);

router.patch(
  '/me/menu/items/:itemId',
  asyncHandler(async (req, res) => {
    const restaurant = await ownedRestaurant(req.user);
    const found = restaurant.findMenuItem(req.params.itemId);
    if (!found) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Menu item not found' } });
    if (typeof req.body?.available === 'boolean') found.item.available = req.body.available;
    if (Number.isFinite(Number(req.body?.priceCents))) found.item.priceCents = Math.max(0, Math.round(Number(req.body.priceCents)));
    if (Number.isFinite(Number(req.body?.prepMinutes))) found.item.prepMinutes = Math.max(1, Math.round(Number(req.body.prepMinutes)));
    await restaurant.save();
    const view = restaurantPublicView(restaurant);
    bus.notifyAdmin('restaurant:menu', { id: view.id, name: view.name });
    res.json({ menu: view.menu });
  })
);

module.exports = router;
