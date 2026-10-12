const env = require('../config/env');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const Courier = require('../models/Courier');
const bus = require('../realtime/bus');
const { STATUS, OFFER_STATE, ACTIVE_FOR_COURIER } = require('./status');
const { distanceMeters, coordsToLatLng } = require('./geo');
const { courierPublicView } = require('./serialize');

const offerTimers = new Map();
const retryTimers = new Map();

const LOAD_PENALTY_MINUTES_PER_ORDER = 6;

/**
 * Ranking blends distance with current load, and a courier at the cap is excluded
 * outright rather than demoted — nearest-first alone piled jobs onto whoever parked
 * closest to the busiest kitchen.
 */
function rankCandidates(couriers, restaurantLatLng, { loadCap = env.courierLoadCap, exclude = [] } = {}) {
  const excluded = new Set(exclude.map(String));
  return couriers
    .filter((c) => c.isOnline && String(c._id) && !excluded.has(String(c._id)))
    .filter((c) => (c.activeOrders || 0) < loadCap)
    .map((c) => {
      const coords = c.lastKnownLocation?.coordinates;
      const from = coords ? coordsToLatLng(coords) : null;
      const metres = distanceMeters(from, restaurantLatLng);
      const minutesToArrive = metres == null ? 999 : Math.round((metres * 1.35) / 1000 / 24 * 60);
      const score = minutesToArrive + (c.activeOrders || 0) * LOAD_PENALTY_MINUTES_PER_ORDER;
      return { courier: c, distanceMeters: metres, minutesToArrive, score };
    })
    .filter((entry) => entry.distanceMeters != null)
    .sort((a, b) => a.score - b.score || a.distanceMeters - b.distanceMeters);
}

function clearOfferTimer(orderId) {
  const timer = offerTimers.get(String(orderId));
  if (timer) {
    clearTimeout(timer);
    offerTimers.delete(String(orderId));
  }
}

function clearRetryTimer(orderId) {
  const timer = retryTimers.get(String(orderId));
  if (timer) {
    clearTimeout(timer);
    retryTimers.delete(String(orderId));
  }
}

function stopAllTimers() {
  for (const t of offerTimers.values()) clearTimeout(t);
  for (const t of retryTimers.values()) clearTimeout(t);
  offerTimers.clear();
  retryTimers.clear();
}

async function recordAttempt(order, entry, reason) {
  order.offer.attempts.push({
    courierId: entry.courier._id,
    courierName: entry.courier.name,
    distanceMeters: entry.distanceMeters,
    reason
  });
  // keep the aggregate bounded; the count is what matters after ~12 attempts
  if (order.offer.attempts.length > 12) order.offer.attempts.splice(0, order.offer.attempts.length - 12);
  await order.save();
}

function triedCourierIds(order) {
  return (order.offer.attempts || []).map((a) => String(a.courierId));
}

async function findCandidates(order, restaurant, radiusMeters) {
  const lat = restaurant.location.coordinates[1];
  const lng = restaurant.location.coordinates[0];
  const couriers = await Courier.find({
    isOnline: true,
    lastKnownLocation: { $geoWithin: { $centerSphere: [[lng, lat], radiusMeters / 6378100] } }
  }).lean();
  await reconcileLoad(couriers);
  return rankCandidates(couriers, { lat, lng }, { exclude: triedCourierIds(order) });
}

/**
 * `activeOrders` is a cache written at each transition, so a crash or a cancellation between
 * the two can leave a courier permanently at the cap with nothing in his bag. Ranking reads
 * the real open jobs and repairs the cache in passing.
 */
async function reconcileLoad(couriers) {
  if (!couriers.length) return;
  const counted = await Order.aggregate([
    { $match: { courierId: { $in: couriers.map((c) => c._id) }, status: { $in: ACTIVE_FOR_COURIER } } },
    { $group: { _id: '$courierId', n: { $sum: 1 } } }
  ]);
  const live = new Map(counted.map((row) => [String(row._id), row.n]));
  for (const courier of couriers) {
    const actual = live.get(String(courier._id)) || 0;
    if (courier.activeOrders === actual) continue;
    courier.activeOrders = actual;
    await Courier.updateOne({ _id: courier._id }, { $set: { activeOrders: actual } });
  }
}

/** Offer this order to the best available courier, widening the radius as attempts fail. */
async function offerFor(orderId, { reason = 'assignment' } = {}) {
  clearRetryTimer(orderId);
  const order = await Order.findById(orderId);
  if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' };
  if (![STATUS.PREPARING, STATUS.READY].includes(order.status)) return { ok: false, error: 'NOT_ASSIGNABLE' };
  if (order.offer.state === OFFER_STATE.OFFERED) return { ok: false, error: 'OFFER_ALREADY_LIVE' };
  if (order.courierId) return { ok: false, error: 'ALREADY_ASSIGNED' };

  const restaurant = await Restaurant.findById(order.restaurantId);
  if (!restaurant) return { ok: false, error: 'RESTAURANT_NOT_FOUND' };

  const attempts = (order.offer.attempts || []).length;
  if (attempts >= env.assignmentMaxAttempts) {
    order.offer.state = OFFER_STATE.EXHAUSTED;
    await order.save();
    bus.notifyAdmin('assignment:exhausted', { orderId: String(order._id), reason });
    return { ok: false, error: 'NO_CANDIDATES_LEFT' };
  }

  const radius =
    order.offer.radiusMeters && reason === 'watchdog'
      ? order.offer.radiusMeters + env.assignmentRadiusStepMeters
      : env.assignmentRadiusStartMeters + attempts * env.assignmentRadiusStepMeters;

  const candidates = await findCandidates(order, restaurant, radius);
  if (candidates.length === 0) {
    order.offer.radiusMeters = radius;
    order.offer.state = OFFER_STATE.NONE;
    await order.save();
    const timer = setTimeout(() => offerFor(order._id, { reason: 'retry' }), env.offerRetryMs);
    timer.unref?.();
    retryTimers.set(String(order._id), timer);
    bus.notifyAdmin('assignment:retry', { orderId: String(order._id), radius, reason });
    return { ok: false, error: 'NO_CANDIDATES_IN_RADIUS', radius };
  }

  const best = candidates[0];
  const expiresAt = new Date(Date.now() + env.offerTimeoutMs);
  order.offer = {
    ...order.offer.toObject(),
    state: OFFER_STATE.OFFERED,
    courierId: best.courier._id,
    courierUserId: best.courier.userId,
    courierName: best.courier.name,
    offeredAt: new Date(),
    expiresAt,
    radiusMeters: radius
  };
  await order.save();

  const payload = {
    orderId: String(order._id),
    restaurantName: restaurant.name,
    pickup: { name: restaurant.name, address: restaurant.address, lat: restaurant.location.coordinates[1], lng: restaurant.location.coordinates[0] },
    dropoff: { ...order.deliveryAddress, contactPhone: order.contactPhone },
    customerName: order.customerName || null,
    distanceToRestaurantMeters: best.distanceMeters,
    orderTotalCents: order.totalCents,
    courierFeeCents: order.courierFeeCents,
    expiresAt: expiresAt.toISOString(),
    timeoutMs: env.offerTimeoutMs
  };
  bus.emitToRoom(bus.userRoom(best.courier.userId), 'courier:offer', payload);
  bus.notifyAdmin('assignment:offered', { orderId: String(order._id), courier: courierPublicView(best.courier), radius });

  const timer = setTimeout(() => expireOffer(String(order._id), String(best.courier._id)), env.offerTimeoutMs);
  timer.unref?.();
  offerTimers.set(String(order._id), timer);
  return { ok: true, courierId: String(best.courier._id), distanceMeters: best.distanceMeters, radius };
}

/** Offer timed out: record it, tell that courier nothing more, fall through to the next. */
async function expireOffer(orderId, courierId) {
  offerTimers.delete(String(orderId));
  const order = await Order.findById(orderId);
  if (!order || order.offer.state !== OFFER_STATE.OFFERED) return { ok: false };
  if (courierId && String(order.offer.courierId) !== String(courierId)) return { ok: false };

  const entry = { courier: { _id: order.offer.courierId, name: order.offer.courierName }, distanceMeters: null };
  order.offer.state = OFFER_STATE.EXPIRED;
  await recordAttempt(order, entry, 'expired');
  if (order.offer.courierUserId) {
    bus.emitToRoom(bus.userRoom(order.offer.courierUserId), 'courier:offer:closed', { orderId, reason: 'expired' });
  }
  return offerFor(orderId, { reason: 'after-expiry' });
}

async function respondToOffer({ orderId, decision, courierId, userId }) {
  const order = await Order.findById(orderId);
  if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' };
  if (order.offer.state !== OFFER_STATE.OFFERED) return { ok: false, error: 'OFFER_NO_LONGER_LIVE' };
  if (String(order.offer.courierId) !== String(courierId)) return { ok: false, error: 'OFFER_NOT_FOR_YOU' };

  clearOfferTimer(orderId);
  const courier = await Courier.findById(courierId);
  if (!courier || String(courier.userId) !== String(userId)) return { ok: false, error: 'COURIER_MISMATCH' };

  const entry = { courier, distanceMeters: null };

  if (decision === 'accept') {
    order.offer.state = OFFER_STATE.ACCEPTED;
    await recordAttempt(order, entry, 'accepted');
    const { transition } = require('./orderService');
    await transition(order._id, {
      to: STATUS.ASSIGNED,
      actor: 'courier',
      actorId: courier.userId,
      note: `${courier.name} accepted the job`,
      meta: { courierId: courier._id }
    });
    // Everyone else who saw this offer is told it is gone, so no stale countdown remains.
    bus.emitToRoom(bus.COURIER_POOL_ROOM, 'courier:offer:closed', { orderId, reason: 'taken' });
    return { ok: true, status: order.status };
  }

  order.offer.state = OFFER_STATE.DECLINED;
  courier.cancelledByCourier = (courier.cancelledByCourier || 0) + 1;
  await courier.save();
  await recordAttempt(order, entry, 'declined');
  bus.emitToRoom(bus.COURIER_POOL_ROOM, 'courier:offer:closed', { orderId, reason: 'declined' });
  await offerFor(orderId, { reason: 'after-decline' });
  return { ok: true, status: order.status };
}

/** Called when a kitchen accepts an order — this is what opens it to the pool. */
async function openAssignment(orderId) {
  clearOfferTimer(orderId);
  return offerFor(orderId, { reason: 'restaurant-accepted' });
}

async function activeOrdersForCourier(courierId) {
  return Order.find({ courierId, status: { $in: ACTIVE_FOR_COURIER } }).sort({ pickedUpAt: -1 });
}

module.exports = {
  rankCandidates,
  offerFor,
  expireOffer,
  respondToOffer,
  openAssignment,
  clearOfferTimer,
  clearRetryTimer,
  stopAllTimers,
  activeOrdersForCourier,
  LOAD_PENALTY_MINUTES_PER_ORDER
};
