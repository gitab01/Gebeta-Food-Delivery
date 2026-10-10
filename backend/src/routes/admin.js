const express = require('express');
const Order = require('../models/Order');
const User = require('../models/User');
const Courier = require('../models/Courier');
const Restaurant = require('../models/Restaurant');
const Payment = require('../models/Payment');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { transition, refreshEta } = require('../services/orderService');
const assignment = require('../services/assignment');
const watchdog = require('../services/watchdog');
const { orderPublicView, courierPublicView, restaurantPublicView } = require('../services/serialize');
const { STATUS, ACTIVE_FOR_COURIER, TERMINAL } = require('../services/status');
const env = require('../config/env');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const dayAgo = () => new Date(Date.now() - 864e5);

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const since = dayAgo();
    const [ordersToday, revenue, byStatus, couriers, restaurants, paymentsFailed] = await Promise.all([
      Order.countDocuments({ placedAt: { $gte: since } }),
      Order.aggregate([
        { $match: { status: { $in: [STATUS.DELIVERED, STATUS.COMPLETED] } } },
        { $group: { _id: null, cents: { $sum: '$totalCents' }, orders: { $sum: 1 }, avgPrep: { $avg: { $subtract: ['$readyAt', '$acceptedAt'] } } } }
      ]),
      Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Courier.aggregate([
        { $group: { _id: null, online: { $sum: { $cond: ['$isOnline', 1, 0] } }, total: { $sum: 1 }, carrying: { $sum: { $cond: [{ $gt: ['$activeOrders', 0] }, 1, 0] } } } }
      ]),
      Restaurant.aggregate([{ $group: { _id: null, open: { $sum: { $cond: ['$isOpen', 1, 0] } }, total: { $sum: 1 } } }]),
      Payment.countDocuments({ status: 'failed' })
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
    const activeOrders = byStatus.filter((s) => !TERMINAL.includes(s._id)).reduce((sum, s) => sum + s.n, 0);
    const prepMinutes = revenue[0]?.avgPrep ? Math.round(revenue[0].avgPrep / 60000) : null;
    res.json({
      currency: 'ETB',
      ordersToday,
      revenueCents: revenue[0]?.cents || 0,
      settledOrders: revenue[0]?.orders || 0,
      averagePrepMinutes: prepMinutes,
      ordersByStatus: statusMap,
      activeOrders,
      couriers: { online: couriers[0]?.online || 0, carrying: couriers[0]?.carrying || 0, total: couriers[0]?.total || 0 },
      restaurants: { open: restaurants[0]?.open || 0, total: restaurants[0]?.total || 0 },
      paymentsFailed,
      watchdog: watchdog.status(),
      gateway: env.gateway
    });
  })
);

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    if (req.query.restaurantId) filter.restaurantId = req.query.restaurantId;
    if (req.query.courierId) filter.courierId = req.query.courierId;
    if (req.query.scope === 'live') filter.status = { $nin: TERMINAL };
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(200, Number(req.query.limit) || 60))
      .populate('restaurantId', 'name')
      .populate('courierId', 'name vehicle');
    res.json({ orders: orders.map(orderPublicView) });
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('restaurantId').populate('courierId');
    if (!order) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    const payment = await Payment.findOne({ orderId: order._id }).lean();
    const customer = await User.findById(order.customerId).select('name phone addresses').lean();
    res.json({
      order: {
        ...orderPublicView(order),
        deliveryAddress: order.deliveryAddress,
        contactPhone: order.contactPhone,
        customer: customer ? { id: String(customer._id), name: customer.name, phone: customer.phone } : null
      },
      payment: payment
        ? { status: payment.status, amountCents: payment.amountCents, gateway: payment.gateway, method: payment.method, gatewayRef: payment.gatewayRef, confirmedAt: payment.confirmedAt }
        : null
    });
  })
);

/** Ops override: move an order to any legal next state, or hand it back to the pool. */
router.post(
  '/orders/:id/transition',
  asyncHandler(async (req, res) => {
    const to = String(req.body?.to || '').toUpperCase();
    const { order, changed } = await transition(req.params.id, {
      to,
      actor: 'system',
      note: req.body?.note || `Moved to ${to} by operations`
    });
    if (!changed) return res.status(409).json({ error: { code: 'NO_CHANGE', message: `Order is already ${order.status}` } });
    res.json({ order: orderPublicView(await order.populate(['restaurantId', 'courierId'])) });
  })
);

router.post(
  '/orders/:id/reassign',
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    if (order.courierId) {
      const courier = await Courier.findById(order.courierId);
      if (courier) {
        courier.activeOrders = Math.max(0, (courier.activeOrders || 1) - 1);
        await courier.save();
      }
      order.courierId = null;
      order.courierUserId = null;
      order.courierName = null;
    }
    order.offer.state = 'NONE';
    order.offer.attempts = [];
    order.offer.radiusMeters = env.assignmentRadiusStartMeters;
    await order.save();
    const result = await assignment.offerFor(order._id, { reason: 'manual-reassign' });
    await refreshEta(order._id, { force: true });
    res.json({ result, order: orderPublicView(await order.populate(['restaurantId', 'courierId'])) });
  })
);

router.get(
  '/couriers',
  asyncHandler(async (_req, res) => {
    const couriers = await Courier.find().sort({ isOnline: -1, name: 1 });
    const active = await Order.find({ status: { $in: ACTIVE_FOR_COURIER } }).select('courierId status eta').lean();
    const jobs = Object.fromEntries(active.filter((o) => o.courierId).map((o) => [String(o.courierId), o.status]));
    res.json({ couriers: couriers.map(courierPublicView), liveJobs: jobs });
  })
);

router.get(
  '/restaurants',
  asyncHandler(async (_req, res) => {
    const restaurants = await Restaurant.find().sort({ name: 1 });
    res.json({ restaurants: restaurants.map(restaurantPublicView) });
  })
);

router.patch(
  '/restaurants/:id',
  asyncHandler(async (req, res) => {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } });
    if (typeof req.body?.isOpen === 'boolean') restaurant.isOpen = req.body.isOpen;
    if (Number.isFinite(Number(req.body?.basePrepMinutes))) restaurant.basePrepMinutes = Math.max(5, Math.round(Number(req.body.basePrepMinutes)));
    if (Number.isFinite(Number(req.body?.minOrderCents))) restaurant.minOrderCents = Math.max(0, Math.round(Number(req.body.minOrderCents)));
    await restaurant.save();
    res.json({ restaurant: restaurantPublicView(restaurant) });
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const filter = req.query.role ? { role: String(req.query.role) } : {};
    const q = String(req.query.q || '').trim();
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(safe, 'i');
      filter.$or = [{ phone: re }, { name: re }];
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ users: users.map((u) => ({ id: String(u._id), name: u.name, phone: u.phone, role: u.role, isBlocked: u.isBlocked, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt })) });
  })
);

/** Suspension is the one account action operations needs day to day. */
router.post(
  '/users/:id/block',
  asyncHandler(async (req, res) => {
    const isBlocked = Boolean(req.body?.isBlocked);
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ error: { code: 'SELF_BLOCK', message: 'You cannot suspend your own account' } });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    user.isBlocked = isBlocked;
    await user.save();
    res.json({ user: { id: String(user._id), name: user.name, phone: user.phone, role: user.role, isBlocked: user.isBlocked } });
  })
);

router.post(
  '/watchdog/sweep',
  asyncHandler(async (_req, res) => {
    res.json({ orphans: await watchdog.sweep() });
  })
);

module.exports = router;
