const mongoose = require('mongoose');
const env = require('../config/env');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const Courier = require('../models/Courier');
const Payment = require('../models/Payment');
const { STATUS, ACTOR, assertTransition, isTerminal } = require('./status');
const { distanceMeters, travelMinutes } = require('./geo');
const { buildEta, rollingPrepMinutes } = require('./eta');
const bus = require('../realtime/bus');
const { orderPublicView } = require('./serialize');

const MILESTONES = {
  [STATUS.PAID]: 'paidAt',
  [STATUS.PREPARING]: 'acceptedAt',
  [STATUS.READY]: 'readyAt',
  [STATUS.ASSIGNED]: 'assignedAt',
  [STATUS.PICKED_UP]: 'pickedUpAt',
  [STATUS.DELIVERED]: 'deliveredAt',
  [STATUS.COMPLETED]: 'completedAt',
  [STATUS.REJECTED]: 'closedAt',
  [STATUS.CANCELLED]: 'closedAt'
};

function priceCart(restaurant, lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw Object.assign(new Error('Cart is empty'), { status: 400 });
  }
  if (!restaurant.isOpen) {
    throw Object.assign(new Error(`${restaurant.name} is closed right now`), { status: 409, code: 'RESTAURANT_CLOSED' });
  }
  const items = lines.map(({ menuItemId, qty }) => {
    const n = Math.max(1, Math.min(20, Number(qty) || 1));
    const found = restaurant.findMenuItem(menuItemId);
    if (!found) throw Object.assign(new Error(`Menu item ${menuItemId} is not offered here`), { status: 400 });
    if (!found.item.available) {
      throw Object.assign(new Error(`${found.item.name} is unavailable — remove it to continue`), { status: 409, code: 'ITEM_UNAVAILABLE' });
    }
    return {
      menuItemId: new mongoose.Types.ObjectId(menuItemId),
      name: found.item.name,
      emoji: found.item.emoji,
      qty: n,
      unitPriceCents: found.item.priceCents,
      lineTotalCents: found.item.priceCents * n
    };
  });
  const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);
  if (subtotalCents < restaurant.minOrderCents) {
    throw Object.assign(new Error(`Minimum order is ${(restaurant.minOrderCents / 100).toFixed(2)}`), {
      status: 400,
      code: 'BELOW_MINIMUM'
    });
  }
  return { items, subtotalCents };
}

function feesFor(subtotalCents, distanceM) {
  const deliveryFeeCents = env.deliveryFeeCents;
  const serviceFeeCents = Math.round((subtotalCents * env.serviceRateBps) / 10000);
  return {
    deliveryFeeCents,
    serviceFeeCents,
    totalCents: subtotalCents + deliveryFeeCents + serviceFeeCents,
    courierFeeCents: env.courierFeeCents + Math.round((distanceM || 0) / 1000) * 50
  };
}

async function createOrder({ customer, restaurantId, lines, addressId, deliveryAddress, contactPhone, notes }) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) throw Object.assign(new Error('Restaurant not found'), { status: 404 });

  let address = deliveryAddress;
  if (addressId) {
    const found = customer.addresses.id(addressId);
    if (!found) throw Object.assign(new Error('Saved address not found'), { status: 400 });
    address = { label: found.label, line: found.line, city: found.city, lat: found.lat, lng: found.lng };
  }
  if (!address || !Number.isFinite(address.lat) || !Number.isFinite(address.lng)) {
    throw Object.assign(new Error('A delivery address with coordinates is required'), { status: 400 });
  }

  const { items, subtotalCents } = priceCart(restaurant, lines);
  const restaurantLatLng = { lat: restaurant.location.coordinates[1], lng: restaurant.location.coordinates[0] };
  const metres = distanceMeters(restaurantLatLng, { lat: address.lat, lng: address.lng });
  if (metres != null && metres > restaurant.deliveryRadiusMeters) {
    throw Object.assign(new Error('This address is outside the restaurant’s delivery radius'), {
      status: 409,
      code: 'OUT_OF_RANGE'
    });
  }
  const fees = feesFor(subtotalCents, metres);

  const order = new Order({
    customerId: customer._id,
    restaurantId: restaurant._id,
    items,
    ...fees,
    subtotalCents,
    status: STATUS.PLACED,
    deliveryAddress: { label: address.label, line: address.line, city: address.city, lat: address.lat, lng: address.lng },
    contactPhone: contactPhone || customer.phone,
    notes: notes || '',
    distanceMeters: metres,
    statusHistory: [{ status: STATUS.PLACED, at: new Date(), actor: ACTOR.CUSTOMER, actorId: customer._id, note: 'Order placed' }]
  });
  order.eta = buildEta({ status: STATUS.PLACED, order, restaurant });
  await order.save();

  await Payment.create({
    orderId: order._id,
    customerId: customer._id,
    amountCents: order.totalCents,
    method: env.gateway === 'stripe' ? 'card' : 'mock',
    gateway: env.gateway,
    status: 'requires_payment'
  });

  const view = orderPublicView(order);
  await bus.publishOrder(order.populate(['restaurantId', 'courierId']));
  bus.notifyRestaurant(restaurant._id, 'order:new', view);
  bus.notifyAdmin('order:new', view);
  return order;
}

/**
 * The only way an order changes state. Validation happens before the write, the
 * broadcast happens after it, so no client can ever be told about a state that
 * was not persisted.
 */
async function transition(orderId, { to, actor = ACTOR.SYSTEM, actorId = null, note = '', meta = {} } = {}) {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.status === to) return { order, changed: false };

  assertTransition(order.status, to, actor);

  const assignment = require('./assignment');
  let [restaurant, courier] = await Promise.all([
    Restaurant.findById(order.restaurantId),
    order.courierId ? Courier.findById(order.courierId) : null
  ]);

  const milestone = MILESTONES[to];
  if (milestone) order[milestone] = new Date();
  order.recordStatus(to, { actor, actorId, note });

  if (to === STATUS.PREPARING) {
    order.prepStartedAt = order.prepStartedAt || new Date();
  }
  if (to === STATUS.ASSIGNED) {
    const next = await Courier.findById(meta.courierId);
    if (!next) throw Object.assign(new Error('Courier no longer exists'), { status: 409 });
    order.courierId = next._id;
    order.courierUserId = next.userId;
    order.courierName = next.name;
    order.courierVehicle = next.vehicle;
    next.activeOrders = (next.activeOrders || 0) + 1;
    await next.save();
    courier = next;
  }
  if (to === STATUS.REJECTED) order.rejectReason = note || order.rejectReason || 'Restaurant could not take this order';
  if (to === STATUS.CANCELLED) order.cancelReason = note || order.cancelReason || 'Cancelled';

  if (isTerminal(to)) {
    assignment.clearOfferTimer(String(order._id));
    order.offer.state = order.offer.state === 'ACCEPTED' ? 'ACCEPTED' : 'EXHAUSTED';
  }
  if (to === STATUS.CANCELLED || to === STATUS.REJECTED) {
    if (order.courierId) {
      const assigned = await Courier.findById(order.courierId);
      if (assigned) {
        assigned.activeOrders = Math.max(0, (assigned.activeOrders || 1) - 1);
        await assigned.save();
      }
    }
    // Any settled payment on a closed order becomes a refund, whether or not a
    // courier was ever dispatched. On a live gateway the transfer itself is the
    // PSP's call, so the record carries the intent for operations to reconcile.
    await Payment.findOneAndUpdate(
      { orderId: order._id, status: 'succeeded' },
      { status: 'refunded', refundedAt: new Date(), 'raw.refundReason': to === STATUS.REJECTED ? 'restaurant-declined' : 'order-cancelled' }
    );
  }
  if (to === STATUS.COMPLETED) {
    order.restaurantPayoutCents = order.subtotalCents + order.serviceFeeCents - Math.round(order.subtotalCents * 0.15);
    if (courier) {
      courier.activeOrders = Math.max(0, (courier.activeOrders || 1) - 1);
      courier.completedDeliveries = (courier.completedDeliveries || 0) + 1;
      courier.earningsCents = (courier.earningsCents || 0) + order.courierFeeCents;
      await courier.save();
    }
    if (restaurant) {
      const actualPrep = order.acceptedAt && order.readyAt
        ? (new Date(order.readyAt) - new Date(order.acceptedAt)) / 60000
        : null;
      const history = await Order.find({ restaurantId: restaurant._id, status: STATUS.COMPLETED, readyAt: { $ne: null } })
        .select('acceptedAt readyAt')
        .sort({ readyAt: -1 })
        .limit(21)
        .lean();
      const samples = history.map((h) => (new Date(h.readyAt) - new Date(h.acceptedAt)) / 60000);
      if (actualPrep != null) samples.unshift(actualPrep);
      restaurant.rollingPrepMinutes = rollingPrepMinutes(samples, restaurant.basePrepMinutes);
      restaurant.completedCount = (restaurant.completedCount || 0) + 1;
      await restaurant.save();
    }
    await Payment.findOneAndUpdate({ orderId: order._id, status: 'succeeded' }, { 'raw.settledAt': new Date() });
  }

  order.eta = buildEta({
    status: to,
    order,
    restaurant,
    courier,
    courierLocation: courier?.lastKnownLocation?.coordinates
      ? { lat: courier.lastKnownLocation.coordinates[1], lng: courier.lastKnownLocation.coordinates[0] }
      : null
  });

  await order.save();
  const populated = await order.populate(['restaurantId', 'courierId']);
  await bus.publishOrder(populated, { courier, restaurant });
  return { order, changed: true };
}

/** Recompute and broadcast the ETA without a status change (courier moved, prep ran long). */
async function refreshEta(orderId, { force = false } = {}) {
  const order = await Order.findById(orderId);
  if (!order || isTerminal(order.status)) return null;
  const [restaurant, courier] = await Promise.all([
    Restaurant.findById(order.restaurantId),
    order.courierId ? Courier.findById(order.courierId) : null
  ]);
  const courierLocation = courier?.lastKnownLocation?.coordinates
    ? { lat: courier.lastKnownLocation.coordinates[1], lng: courier.lastKnownLocation.coordinates[0] }
    : null;
  const next = buildEta({ status: order.status, order, restaurant, courier, courierLocation });
  const previous = order.eta?.minutes;
  if (!force && previous != null && Math.abs((previous || 0) - next.minutes) < 1) return null;
  order.eta = next;
  await order.save();
  const view = orderPublicView(order);
  if (bus.getIo()) {
    bus.getIo().to(bus.orderRoom(order._id)).emit('order:eta', { orderId: String(order._id), eta: next, previous });
    bus.notifyAdmin('order:eta', { orderId: String(order._id), eta: next, previous });
  }
  return view;
}

/** PII-aware single-order read for REST clients. */
async function getOrderForRequester(orderId, user) {
  const order = await Order.findById(orderId).populate('restaurantId').populate('courierId');
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  const isOwner = String(order.customerId?._id || order.customerId) === String(user._id);
  const isAssignedCourier = user.role === 'courier' && String(order.courierUserId) === String(user._id);
  const restaurant = await Restaurant.findOne({ ownerId: user._id }).select('_id').lean();
  const isRestaurantOwner = restaurant && String(restaurant._id) === String(order.restaurantId?._id || order.restaurantId);
  if (user.role !== 'admin' && !isOwner && !isAssignedCourier && !isRestaurantOwner) {
    throw Object.assign(new Error('Not a participant on this order'), { status: 403 });
  }
  const view = orderPublicView(order);
  if (isOwner) {
    view.deliveryAddress = order.deliveryAddress;
    view.customerView = true;
  }
  if (isAssignedCourier) {
    const courier = await Courier.findById(order.courierId);
    const { courierJobView } = require('./serialize');
    return courierJobView(order, courier, order.restaurantId);
  }
  if (isRestaurantOwner || user.role === 'admin') {
    const { ADDRESS_VISIBLE } = require('./status');
    view.deliveryAddressLine = ADDRESS_VISIBLE.includes(order.status) ? order.deliveryAddress?.line || null : null;
    view.contactPhone = ADDRESS_VISIBLE.includes(order.status) && user.role === 'admin' ? order.contactPhone : undefined;
  }
  return view;
}

module.exports = { createOrder, transition, refreshEta, getOrderForRequester, priceCart, feesFor, MILESTONES };
