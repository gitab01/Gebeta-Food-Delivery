const express = require('express');
const Order = require('../models/Order');
const Courier = require('../models/Courier');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { transition, refreshEta } = require('../services/orderService');
const { orderPublicView, courierJobView, courierPublicView } = require('../services/serialize');
const { STATUS, ACTOR, ACTIVE_FOR_COURIER } = require('../services/status');
const { distanceMeters } = require('../services/geo');
const Restaurant = require('../models/Restaurant');
const env = require('../config/env');
const bus = require('../realtime/bus');

const router = express.Router();
router.use(requireAuth, requireRole('courier'));

async function me(req) {
  const courier = await Courier.findOne({ userId: req.user._id });
  if (!courier) throw Object.assign(new Error('No courier profile for this account'), { status: 404 });
  return courier;
}

/**
 * Pickup and delivery are confirmed, never inferred — but a confirmation has to be
 * true, so it is checked against the courier's last reported position.
 */
function assertNear(actual, target, toleranceMeters, label) {
  const metres = distanceMeters(actual, target);
  if (metres == null) {
    throw Object.assign(new Error(`Send your location before confirming ${label}`), { status: 409, code: 'LOCATION_REQUIRED' });
  }
  if (metres > toleranceMeters) {
    throw Object.assign(new Error(`You are ${(metres / 1000).toFixed(1)} km from the ${label} — confirm once you arrive`), {
      status: 409,
      code: 'NOT_AT_LOCATION',
      distanceMeters: metres
    });
  }
  return metres;
}

async function jobFor(orderId, courierId) {
  const order = await Order.findById(orderId).populate('restaurantId');
  if (!order || String(order.courierId) !== String(courierId)) {
    throw Object.assign(new Error('That job is not yours'), { status: 404 });
  }
  return order;
}

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const courier = await me(req);
    const active = await Order.find({ courierId: courier._id, status: { $in: ACTIVE_FOR_COURIER } })
      .populate('restaurantId')
      .sort({ assignedAt: -1 });
    res.json({
      courier: courierPublicView(courier),
      jobs: active.map((o) => courierJobView(o, courier, o.restaurantId))
    });
  })
);

router.post(
  '/online',
  asyncHandler(async (req, res) => {
    const courier = await me(req);
    courier.isOnline = Boolean(req.body?.isOnline);
    if (!courier.isOnline && courier.activeOrders > 0) {
      return res.status(409).json({
        error: { code: 'CARRYING_ORDERS', message: `Finish or hand back ${courier.activeOrders} active order(s) before going offline` }
      });
    }
    await courier.save();
    const view = { id: String(courier._id), isOnline: courier.isOnline, activeOrders: courier.activeOrders };
    bus.emitToRoom(bus.COURIER_POOL_ROOM, 'courier:presence', view);
    bus.notifyAdmin('courier:presence', view);
    res.json({ courier: courierPublicView(courier) });
  })
);

/** REST fallback for location when a socket is unavailable (also used to seed a position). */
router.post(
  '/location',
  asyncHandler(async (req, res) => {
    const courier = await me(req);
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'lat and lng are required' } });
    }
    const now = Date.now();
    const sinceLast = now - (courier.locationUpdatedAt ? new Date(courier.locationUpdatedAt).getTime() : 0);
    courier.lastKnownLocation = { type: 'Point', coordinates: [lng, lat] };
    courier.locationUpdatedAt = new Date();
    await courier.save();
    const open = await Order.find({ courierId: courier._id, status: { $in: ACTIVE_FOR_COURIER } }).select('_id');
    for (const order of open) {
      bus.emitToRoom(bus.orderRoom(order._id), 'courier:location', { courierId: String(courier._id), lat, lng, at: courier.locationUpdatedAt });
      await refreshEta(order._id);
    }
    bus.notifyAdmin('courier:location', { courierId: String(courier._id), lat, lng, isOnline: courier.isOnline });
    res.json({ ok: true, throttled: sinceLast < env.locationThrottleMs, acceptedAt: courier.locationUpdatedAt });
  })
);

router.get(
  '/jobs',
  asyncHandler(async (req, res) => {
    const courier = await me(req);
    const scope = req.query.scope === 'history' ? { status: { $in: [STATUS.DELIVERED, STATUS.COMPLETED] } } : { status: { $in: ACTIVE_FOR_COURIER } };
    const orders = await Order.find({ courierId: courier._id, ...scope }).populate('restaurantId').sort({ createdAt: -1 }).limit(30);
    res.json({ jobs: orders.map((o) => courierJobView(o, courier, o.restaurantId)) });
  })
);

router.post(
  '/jobs/:id/pickup',
  asyncHandler(async (req, res) => {
    const courier = await me(req);
    const order = await jobFor(req.params.id, courier._id);
    const here = courier.lastKnownLocation?.coordinates
      ? { lat: courier.lastKnownLocation.coordinates[1], lng: courier.lastKnownLocation.coordinates[0] }
      : null;
    const restaurantLatLng = order.restaurantId?.location
      ? { lat: order.restaurantId.location.coordinates[1], lng: order.restaurantId.location.coordinates[0] }
      : null;
    assertNear(here, restaurantLatLng, env.pickupToleranceMeters, 'restaurant');
    const { order: updated } = await transition(order._id, {
      to: STATUS.PICKED_UP,
      actor: ACTOR.COURIER,
      actorId: req.user._id,
      note: 'Collected from the restaurant'
    });
    res.json({ order: courierJobView(await updated.populate('restaurantId'), courier, order.restaurantId) });
  })
);

router.post(
  '/jobs/:id/deliver',
  asyncHandler(async (req, res) => {
    const courier = await me(req);
    const order = await jobFor(req.params.id, courier._id);
    const here = courier.lastKnownLocation?.coordinates
      ? { lat: courier.lastKnownLocation.coordinates[1], lng: courier.lastKnownLocation.coordinates[0] }
      : null;
    assertNear(here, order.deliveryAddress, env.dropoffToleranceMeters, 'drop-off');
    const { order: updated } = await transition(order._id, {
      to: STATUS.DELIVERED,
      actor: ACTOR.COURIER,
      actorId: req.user._id,
      note: 'Handed to the customer'
    });
    const restaurant = await Restaurant.findById(order.restaurantId);
    res.json({ order: courierJobView(updated, courier, restaurant) });
  })
);

router.get(
  '/earnings',
  asyncHandler(async (req, res) => {
    const courier = await me(req);
    const settled = await Order.find({ courierId: courier._id, status: { $in: [STATUS.DELIVERED, STATUS.COMPLETED] } })
      .select('deliveredAt courierFeeCents totalCents status')
      .sort({ deliveredAt: -1 })
      .limit(60)
      .lean();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const cents = (rows) => rows.reduce((sum, r) => sum + (r.courierFeeCents || 0), 0);
    res.json({
      currency: 'ETB',
      lifetimeCents: courier.earningsCents,
      todayCents: cents(settled.filter((r) => r.deliveredAt && new Date(r.deliveredAt) >= todayStart)),
      weekCents: cents(settled.filter((r) => r.deliveredAt && new Date(r.deliveredAt) >= new Date(Date.now() - 7 * 864e5))),
      completedDeliveries: courier.completedDeliveries,
      ratingStars: courier.ratingStars,
      ratingCount: courier.ratingCount,
      rows: settled.map((r) => ({
        orderId: String(r._id),
        deliveredAt: r.deliveredAt,
        feeCents: r.courierFeeCents,
        orderTotalCents: r.totalCents,
        status: r.status
      }))
    });
  })
);

module.exports = router;
