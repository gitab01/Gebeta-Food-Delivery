const Order = require('../models/Order');
const { distanceMeters } = require('./geo');

/**
 * A courier pings every few seconds for the whole life of a delivery. Two rules keep
 * the trail useful instead of expensive: points that barely move are dropped as GPS
 * jitter, and the array is capped by an atomic $push so an order document can never
 * grow without bound.
 */
const TRAIL_MAX_POINTS = 150;
const TRAIL_MIN_METRES = 20;

async function recordTrail(order, { lat, lng }) {
  if (!order || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const last = order.courierTrail?.[order.courierTrail.length - 1];
  if (last && distanceMeters(last, { lat, lng }) < TRAIL_MIN_METRES) return null;

  const point = { lat, lng, at: new Date() };
  await Order.updateOne(
    { _id: order._id },
    { $push: { courierTrail: { $each: [point], $slice: -TRAIL_MAX_POINTS } } }
  );
  if (Array.isArray(order.courierTrail)) {
    order.courierTrail.push(point);
    if (order.courierTrail.length > TRAIL_MAX_POINTS) {
      order.courierTrail.splice(0, order.courierTrail.length - TRAIL_MAX_POINTS);
    }
  }
  return point;
}

module.exports = { recordTrail, TRAIL_MAX_POINTS, TRAIL_MIN_METRES };
