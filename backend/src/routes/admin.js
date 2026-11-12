const express = require('express');
const Order = require('../models/Order');
const User = require('../models/User');
const Courier = require('../models/Courier');
const CourierDocument = require('../models/CourierDocument');
const verification = require('../services/courierVerification');
const Restaurant = require('../models/Restaurant');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const bus = require('../realtime/bus');
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

/**
 * The queue of identity files. Photos are never included here — the list says whether both
 * sides are on file, and the admin opens a side only when they are looking at that courier.
 */
router.get(
  '/couriers/verification',
  asyncHandler(async (req, res) => {
    const status = ['pending', 'approved', 'rejected', 'all'].includes(req.query.status) ? String(req.query.status) : 'pending';
    const filter = status === 'all' ? {} : { 'verification.status': status };
    const couriers = await Courier.find(filter).sort({ 'verification.submittedAt': 1 }).limit(200);
    const docs = await CourierDocument.find({ courierId: { $in: couriers.map((c) => c._id) } })
      .select('courierId documentType front.bytes back.bytes')
      .lean();
    const byCourier = Object.fromEntries(docs.map((d) => [String(d.courierId), d]));
    const users = await User.find({ _id: { $in: couriers.map((c) => c.userId) } }).select('name phone createdAt').lean();
    const byUser = Object.fromEntries(users.map((u) => [String(u._id), u]));

    res.json({
      couriers: couriers.map((c) => {
        const doc = byCourier[String(c._id)];
        return {
          courierId: String(c._id),
          userId: String(c.userId),
          name: c.name || byUser[String(c.userId)]?.name || '',
          phone: c.phone || byUser[String(c.userId)]?.phone || '',
          vehicle: c.vehicle,
          createdAt: byUser[String(c.userId)]?.createdAt || null,
          isOnline: Boolean(c.isOnline),
          verification: verification.statusView(c, doc)
        };
      })
    });
  })
);

/**
 * One side of one courier's document, to an admin's browser only. `side` is checked against the
 * model rather than trusting a path, and the response is private and no-store because this is a
 * photograph of somebody's identity.
 */
router.get(
  '/couriers/:userId/verification/document/:side',
  asyncHandler(async (req, res) => {
    const side = req.params.side === 'front' || req.params.side === 'back' ? req.params.side : null;
    if (!side) return res.status(400).json({ error: { code: 'VALIDATION', message: 'side must be front or back' } });

    const courier = await Courier.findOne({ userId: req.params.userId });
    if (!courier) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No courier for that account' } });
    // The photo bytes are `select: false`, so they only arrive on an explicit request.
    // Hydrated rather than lean: `lean()` returns the driver's Binary object, which is not a Buffer.
    const doc = await CourierDocument.findOne({ courierId: courier._id }).select('+front.data +back.data');
    const photo = doc?.[side];
    if (!photo?.data?.length) return res.status(404).json({ error: { code: 'NO_PHOTO', message: 'That side was never submitted' } });

    res.set('Cache-Control', 'private, no-store');
    res.type(photo.contentType).send(photo.data);
  })
);

/** The operator's decision. Whatever it is, the courier is told, in their own app. */
router.post(
  '/couriers/:userId/verification',
  asyncHandler(async (req, res) => {
    const courier = await Courier.findOne({ userId: req.params.userId });
    if (!courier) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No courier for that account' } });
    let updated;
    try {
      updated = await verification.review({
        courierId: courier._id,
        decision: req.body?.decision,
        note: req.body?.note,
        adminId: req.user._id
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: { code: err.code || 'VALIDATION', message: err.message } });
      throw err;
    }
    bus.emitToRoom(bus.userRoom(courier.userId), 'courier:verification', verification.statusView(updated));
    res.json({ courier: courierPublicView(updated) });
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

const SETTINGS_KEYS = [
  'currency', 'language', 'timezone', 'dateFormat',
  'mapsEnabled', 'notifyNewOrder', 'notifyCourierOffline', 'maintenanceMode', 'supportContact'
];

router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const settled = { status: { $in: [STATUS.DELIVERED, STATUS.COMPLETED] } };
    const [placed, revenue, sources, top] = await Promise.all([
      Order.aggregate([
        { $match: { placedAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$placedAt' } }, orders: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $match: { ...settled, completedAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: { $ifNull: ['$completedAt', '$deliveredAt'] } } },
            revenueCents: { $sum: '$totalCents' },
            orders: { $sum: 1 }
          }
        }
      ]),
      Payment.aggregate([
        { $match: { status: 'succeeded', createdAt: { $gte: since } } },
        { $group: { _id: '$method', payments: { $sum: 1 }, amountCents: { $sum: '$amountCents' } } }
      ]),
      Order.aggregate([
        { $match: { ...settled, completedAt: { $gte: since } } },
        { $group: { _id: '$restaurantId', revenueCents: { $sum: '$totalCents' }, orders: { $sum: 1 } } },
        { $sort: { revenueCents: -1 } },
        { $limit: 5 }
      ])
    ]);

    // A chart with missing days reads as an outage, so every day in the window is emitted.
    const placedByDay = new Map(placed.map((r) => [r._id, r.orders]));
    const revenueByDay = new Map(revenue.map((r) => [r._id, r]));
    const series = [];
    for (let i = 0; i < days; i += 1) {
      const day = new Date(since.getTime() + i * 864e5).toISOString().slice(0, 10);
      const row = revenueByDay.get(day);
      series.push({ day, orders: placedByDay.get(day) || 0, revenueCents: row?.revenueCents || 0, settledOrders: row?.orders || 0 });
    }

    const kitchens = top.length ? await Restaurant.find({ _id: { $in: top.map((t) => t._id) } }).select('name').lean() : [];
    const nameById = new Map(kitchens.map((k) => [String(k._id), k.name]));

    res.json({
      currency: 'ETB',
      days,
      since: since.toISOString(),
      series,
      sources: sources.map((s) => ({ method: s._id, payments: s.payments, amountCents: s.amountCents })),
      topRestaurants: top.map((t) => ({
        restaurantId: String(t._id),
        name: nameById.get(String(t._id)) || 'Unknown kitchen',
        orders: t.orders,
        revenueCents: t.revenueCents
      })),
      totals: {
        revenueCents: revenue.reduce((n, r) => n + r.revenueCents, 0),
        orders: placed.reduce((n, r) => n + r.orders, 0),
        settledOrders: revenue.reduce((n, r) => n + r.orders, 0)
      }
    });
  })
);

router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const settings = await Settings.load();
    res.json({ settings, version: require('../../package.json').version, gateway: env.gateway });
  })
);

router.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await Settings.load();
    SETTINGS_KEYS.forEach((key) => {
      if (req.body?.[key] !== undefined) settings[key] = req.body[key];
    });
    await settings.save();
    bus.notifyAdmin('settings:update', settings.toObject());
    res.json({ settings: settings.toObject() });
  })
);

module.exports = router;
