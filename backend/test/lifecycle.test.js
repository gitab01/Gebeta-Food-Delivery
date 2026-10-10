process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/gebeta_test';
process.env.JWT_SECRET = 'test-secret';
process.env.OFFER_TIMEOUT_MS = '20000';
process.env.PICKUP_TOLERANCE_M = '500';
process.env.DROPOFF_TOLERANCE_M = '500';
process.env.LOCATION_THROTTLE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { io: ioClient } = require('socket.io-client');

const { connectDb, disconnectDb, mongoose } = require('../src/config/db');
const { createApp } = require('../src/app');
const { initRealtime } = require('../src/realtime/io');
const { signToken } = require('../src/middleware/auth');
const User = require('../src/models/User');
const Restaurant = require('../src/models/Restaurant');
const Courier = require('../src/models/Courier');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const assignment = require('../src/services/assignment');

const CUSTOMER_HOME = { lat: 9.0279, lng: 38.7945 };
const RESTAURANT_AT = { lat: 9.0089, lng: 38.7578 };

let baseUrl;
let server;
let realtime;
let tokens;
let shiroId;
let addressId;

function client(token) {
  const socket = ioClient(baseUrl, { transports: ['websocket'], forceNew: true, auth: { token } });
  socket.on('connect_error', (err) => {
    socket.__failure = `connect_error: ${err.message}`;
  });
  socket.on('connect', () => {
    socket.__failure = 'connected';
  });
  return socket;
}

function once(socket, event, { match = () => true, timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}" (${socket.__failure || 'no connection attempt'})`));
    }, timeoutMs);
    function handler(payload) {
      if (!match(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

const call = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
};

test.before(async () => {
  await connectDb();
  await Promise.all([
    User.deleteMany({}),
    Restaurant.deleteMany({}),
    Courier.deleteMany({}),
    Order.deleteMany({}),
    mongoose.connection.db.collection('payments').deleteMany({}),
    mongoose.connection.db.collection('ratings').deleteMany({})
  ]);

  const owner = new User({ phone: '0700000001', name: 'Owner', role: 'restaurant' });
  owner.setPassword('gebeta123');
  const customer = new User({
    phone: '0700000002',
    name: 'Customer',
    role: 'customer',
    addresses: [{ label: 'Home', line: 'Rome St', city: 'Addis Ababa', lat: CUSTOMER_HOME.lat, lng: CUSTOMER_HOME.lng, contactPhone: '0700000002' }]
  });
  customer.setPassword('gebeta123');
  const stranger = new User({ phone: '0700000003', name: 'Stranger', role: 'customer' });
  stranger.setPassword('gebeta123');
  const courierUser = new User({ phone: '0700000004', name: 'Courier', role: 'courier' });
  courierUser.setPassword('gebeta123');
  await Promise.all([owner.save(), customer.save(), stranger.save(), courierUser.save()]);

  const restaurant = await Restaurant.create({
    ownerId: owner._id,
    name: 'Test Kitchen',
    cuisine: ['Test'],
    phone: '0711000001',
    address: 'Atlas Rd',
    location: { type: 'Point', coordinates: [RESTAURANT_AT.lng, RESTAURANT_AT.lat] },
    isOpen: true,
    basePrepMinutes: 15,
    deliveryRadiusMeters: 12000,
    minOrderCents: 1000,
    menu: [{ name: 'Mains', items: [{ name: 'Shiro', priceCents: 32000, prepMinutes: 12, available: true }] }]
  });
  await Courier.create({
    userId: courierUser._id,
    name: 'Courier',
    phone: courierUser.phone,
    vehicle: 'motorbike',
    isOnline: true,
    lastKnownLocation: { type: 'Point', coordinates: [RESTAURANT_AT.lng, RESTAURANT_AT.lat] },
    locationUpdatedAt: new Date()
  });

  shiroId = String(restaurant.menu[0].items[0]._id);
  addressId = String(customer.addresses[0]._id);
  tokens = {
    owner: signToken(owner),
    customer: signToken(customer),
    stranger: signToken(stranger),
    courier: signToken(courierUser)
  };

  server = http.createServer(createApp());
  realtime = initRealtime(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  assignment.stopAllTimers();
  if (realtime) await new Promise((resolve) => realtime.close(resolve));
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDb();
});

test('health endpoint reports the realtime service', async () => {
  const { status, body } = await call('/api/health');
  assert.equal(status, 200);
  assert.equal(body.realtime, 'socket.io');
});

test('a closed kitchen or an unavailable dish is refused before money moves', async () => {
  const restaurant = await Restaurant.findOne({ name: 'Test Kitchen' });
  const orderId = String(restaurant._id);
  const cart = { restaurantId: orderId, lines: [{ menuItemId: shiroId, qty: 1 }], addressId };

  await Restaurant.updateOne({ _id: restaurant._id }, { $set: { isOpen: false } });
  const closed = await call('/api/orders', { method: 'POST', token: tokens.customer, body: cart });
  assert.equal(closed.status, 409);
  assert.equal(closed.body.error.code, 'RESTAURANT_CLOSED');

  try {
    await Restaurant.updateOne({ _id: restaurant._id }, { $set: { isOpen: true, 'menu.0.items.0.available': false } });
    const soldOut = await call('/api/orders', { method: 'POST', token: tokens.customer, body: cart });
    assert.equal(soldOut.status, 409);
    assert.equal(soldOut.body.error.code, 'ITEM_UNAVAILABLE');

    await Restaurant.updateOne({ _id: restaurant._id }, { $set: { 'menu.0.items.0.available': true } });
    const belowMinimum = await call('/api/orders', {
      method: 'POST',
      token: tokens.customer,
      body: { ...cart, lines: [{ menuItemId: '000000000000000000000000', qty: 1 }] }
    });
    assert.equal(belowMinimum.status, 400);
  } finally {
    await Restaurant.updateOne({ _id: restaurant._id }, { $set: { isOpen: true, 'menu.0.items.0.available': true } });
  }
});

test('the full three-sided lifecycle, with every party watching the same order', async () => {
  const restaurant = await Restaurant.findOne({ name: 'Test Kitchen' });

  const placed = await call('/api/orders', {
    method: 'POST',
    token: tokens.customer,
    body: {
      restaurantId: String(restaurant._id),
      lines: [{ menuItemId: shiroId, qty: 2 }],
      deliveryAddress: { label: 'Home', line: 'Rome St', lat: CUSTOMER_HOME.lat, lng: CUSTOMER_HOME.lng }
    }
  });
  assert.equal(placed.status, 201);
  const orderId = placed.body.order.id;
  assert.equal(placed.body.order.status, 'PLACED');
  assert.equal(placed.body.order.items[0].lineTotalCents, 64000);

  // Customer and kitchen subscribe from placement; the courier joins once it holds the job.
  const customerSocket = client(tokens.customer);
  const ownerSocket = client(tokens.owner);
  const received = { customer: [], owner: [], courier: [] };
  customerSocket.on('order:update', (p) => received.customer.push(p));
  ownerSocket.on('order:update', (p) => received.owner.push(p));

  await Promise.all([once(customerSocket, 'realtime:ready'), once(ownerSocket, 'realtime:ready')]);

  const joined = await new Promise((resolve) => customerSocket.emit('order:join', { orderId }, resolve));
  assert.equal(joined.ok, true);
  assert.equal(joined.order.status, 'PLACED');
  await new Promise((resolve) => ownerSocket.emit('order:join', { orderId }, resolve));

  // A stranger may not listen in on somebody else's order.
  const strangerSocket = client(tokens.stranger);
  await once(strangerSocket, 'realtime:ready');
  const denied = await new Promise((resolve) => strangerSocket.emit('order:join', { orderId }, resolve));
  assert.equal(denied.ok, false);
  assert.equal(denied.error, 'NOT_ORDER_PARTICIPANT');

  // Payment: only the gateway path moves the order to PAID.
  const intent = await call('/api/payments/intent', { method: 'POST', token: tokens.customer, body: { orderId } });
  assert.equal(intent.status, 200);
  const tooEarly = await call(`/api/orders/${orderId}`, { token: tokens.customer });
  assert.equal(tooEarly.body.order.status, 'PLACED');
  const paid = await call('/api/payments/mock/confirm', { method: 'POST', token: tokens.customer, body: { paymentId: intent.body.intent.paymentId } });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.order.status, 'PAID');

  // Kitchen accepts: this is what opens the order to the courier pool.
  const courierSocket = client(tokens.courier);
  await once(courierSocket, 'realtime:ready');
  const offerPromise = once(courierSocket, 'courier:offer', { match: (p) => p.orderId === orderId, timeoutMs: 10000 });
  const accepted = await call(`/api/restaurant-owner/orders/${orderId}/accept`, { method: 'POST', token: tokens.owner });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.order.status, 'PREPARING');
  const offer = await offerPromise;
  assert.equal(offer.dropoff.line, 'Rome St', 'the courier is given the address only for a job they hold');
  assert.ok(offer.expiresAt, 'the offer carries a countdown');

  const responded = await new Promise((resolve) =>
    courierSocket.emit('courier:offer:respond', { orderId, decision: 'accept' }, resolve)
  );
  assert.equal(responded.ok, true);

  // The courier is a participant now, so it can watch the same room.
  courierSocket.on('order:update', (p) => received.courier.push(p));
  await new Promise((resolve) => courierSocket.emit('order:join', { orderId }, resolve));

  let snapshot = await call(`/api/orders/${orderId}`, { token: tokens.customer });
  assert.equal(snapshot.body.order.status, 'ASSIGNED');
  assert.equal(snapshot.body.order.courierName, 'Courier');
  assert.equal(snapshot.body.order.deliveryAddress.line, 'Rome St', 'the customer keeps seeing their own address');

  // The courier confirms against position, not intent: 4 km from the kitchen is not a pickup.
  await call('/api/courier/location', { method: 'POST', token: tokens.courier, body: { lat: CUSTOMER_HOME.lat, lng: CUSTOMER_HOME.lng } });
  const farPickup = await call(`/api/courier/jobs/${orderId}/pickup`, { method: 'POST', token: tokens.courier });
  assert.equal(farPickup.status, 409);
  assert.equal(farPickup.body.error.code, 'NOT_AT_LOCATION');

  await call('/api/courier/location', { method: 'POST', token: tokens.courier, body: { lat: RESTAURANT_AT.lat + 0.0002, lng: RESTAURANT_AT.lng + 0.0002 } });
  const pickedUp = await call(`/api/courier/jobs/${orderId}/pickup`, { method: 'POST', token: tokens.courier });
  assert.equal(pickedUp.status, 200);
  assert.equal(pickedUp.body.order.status, 'PICKED_UP');

  await call('/api/courier/location', { method: 'POST', token: tokens.courier, body: { lat: CUSTOMER_HOME.lat + 0.0002, lng: CUSTOMER_HOME.lng + 0.0002 } });
  const delivered = await call(`/api/courier/jobs/${orderId}/deliver`, { method: 'POST', token: tokens.courier });
  assert.equal(delivered.status, 200);
  assert.equal(delivered.body.order.status, 'DELIVERED');

  const rated = await call(`/api/orders/${orderId}/rate`, {
    method: 'POST',
    token: tokens.customer,
    body: { restaurantStars: 5, courierStars: 4, restaurantComment: 'Shiro was perfect' }
  });
  assert.equal(rated.status, 200);
  assert.equal(rated.body.order.status, 'COMPLETED');

  await new Promise((resolve) => setTimeout(resolve, 400));

  // Exactly-once fan-out: no transition is emitted twice to a subscribed room.
  for (const [who, list] of Object.entries(received)) {
    const completions = list.filter((p) => p.status === 'COMPLETED');
    assert.equal(completions.length, 1, `${who} received COMPLETED exactly once`);
    assert.equal(new Set(list.map((p) => p.status)).size, list.length, `${who} saw no duplicate transition`);
    assert.equal(list[list.length - 1].statusHistory.length, 7, `${who}'s final payload carries the whole history`);
  }
  assert.deepEqual(
    received.customer.map((p) => p.status),
    ['PAID', 'PREPARING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED']
  );
  assert.deepEqual(
    received.owner.map((p) => p.status),
    ['PAID', 'PREPARING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED']
  );
  assert.deepEqual(
    received.courier.map((p) => p.status),
    ['PICKED_UP', 'DELIVERED', 'COMPLETED'],
    'the courier joined the room after assignment'
  );

  const final = await Order.findById(orderId).lean();
  assert.deepEqual(
    final.statusHistory.map((e) => e.status),
    ['PLACED', 'PAID', 'PREPARING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED']
  );
  assert.equal(final.offer.state, 'ACCEPTED');

  // PII is withdrawn once the job closes.
  const jobs = await call('/api/courier/jobs', { token: tokens.courier });
  assert.equal(jobs.status, 200);
  assert.ok(
    jobs.body.jobs.every((j) => j.id !== orderId),
    'the finished job is no longer in the courier’s active list'
  );

  customerSocket.close();
  ownerSocket.close();
  courierSocket.close();
  strangerSocket.close();
});

test('an illegal transition is refused with 409 and leaves the order untouched', async () => {
  const restaurant = await Restaurant.findOne({ name: 'Test Kitchen' });
  const created = await call('/api/orders', {
    method: 'POST',
    token: tokens.customer,
    body: {
      restaurantId: String(restaurant._id),
      lines: [{ menuItemId: shiroId, qty: 1 }],
      deliveryAddress: { label: 'Home', line: 'Rome St', lat: CUSTOMER_HOME.lat, lng: CUSTOMER_HOME.lng }
    }
  });
  const orderId = created.body.order.id;
  const courierSkipsToDelivery = await call(`/api/courier/jobs/${orderId}/deliver`, { method: 'POST', token: tokens.courier });
  assert.ok([403, 404, 409].includes(courierSkipsToDelivery.status), `refused with ${courierSkipsToDelivery.status}`);
  const still = await call(`/api/orders/${orderId}`, { token: tokens.customer });
  assert.equal(still.body.order.status, 'PLACED');

  const cancelled = await call(`/api/orders/${orderId}/cancel`, { method: 'POST', token: tokens.customer, body: { reason: 'Changed my mind' } });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.order.status, 'CANCELLED');

  const again = await call(`/api/orders/${orderId}/cancel`, { method: 'POST', token: tokens.customer });
  assert.equal(again.status, 409);
});

/**
 * Cancellation before dispatch is the common case, and it is the case that used to
 * take the money and never give it back, because the refund sat inside the courier branch.
 */
test('a paid order cancelled before dispatch is refunded', async () => {
  const restaurant = await Restaurant.findOne({ name: 'Test Kitchen' });
  const created = await call('/api/orders', {
    method: 'POST',
    token: tokens.customer,
    body: {
      restaurantId: String(restaurant._id),
      lines: [{ menuItemId: shiroId, qty: 2 }],
      deliveryAddress: { label: 'Home', line: 'Rome St', lat: CUSTOMER_HOME.lat, lng: CUSTOMER_HOME.lng }
    }
  });
  const orderId = created.body.order.id;

  const intent = await call('/api/payments/intent', { method: 'POST', token: tokens.customer, body: { orderId } });
  assert.equal(intent.status, 200);
  const confirmed = await call('/api/payments/mock/confirm', {
    method: 'POST',
    token: tokens.customer,
    body: { paymentId: intent.body.intent.paymentId }
  });
  assert.equal(confirmed.body.order.status, 'PAID');
  assert.equal((await Payment.findOne({ orderId })).status, 'succeeded');

  const cancelled = await call(`/api/orders/${orderId}/cancel`, {
    method: 'POST',
    token: tokens.customer,
    body: { reason: 'Kitchen was too slow' }
  });
  assert.equal(cancelled.body.order.status, 'CANCELLED');

  const payment = await Payment.findOne({ orderId });
  assert.equal(payment.status, 'refunded');
  assert.ok(payment.refundedAt instanceof Date, 'refundedAt is stamped');
  assert.equal(payment.raw.refundReason, 'order-cancelled');
});

test('a customer token cannot perform restaurant or courier actions', async () => {
  const restaurant = await Restaurant.findOne({ name: 'Test Kitchen' });
  const created = await call('/api/orders', {
    method: 'POST',
    token: tokens.customer,
    body: {
      restaurantId: String(restaurant._id),
      lines: [{ menuItemId: shiroId, qty: 1 }],
      deliveryAddress: { label: 'Home', line: 'Rome St', lat: CUSTOMER_HOME.lat, lng: CUSTOMER_HOME.lng }
    }
  });
  const orderId = created.body.order.id;
  const acceptAsCustomer = await call(`/api/restaurant-owner/orders/${orderId}/accept`, { method: 'POST', token: tokens.customer });
  assert.equal(acceptAsCustomer.status, 403);
  const statsAsCustomer = await call('/api/admin/stats', { token: tokens.customer });
  assert.equal(statsAsCustomer.status, 403);
  const onlineAsCustomer = await call('/api/courier/online', { method: 'POST', token: tokens.customer, body: { isOnline: true } });
  assert.equal(onlineAsCustomer.status, 403);
});

test('reconnect resync: a fresh socket gets the authoritative order on join', async () => {
  const restaurant = await Restaurant.findOne({ name: 'Test Kitchen' });
  const created = await call('/api/orders', {
    method: 'POST',
    token: tokens.customer,
    body: {
      restaurantId: String(restaurant._id),
      lines: [{ menuItemId: shiroId, qty: 1 }],
      deliveryAddress: { label: 'Home', line: 'Rome St', lat: CUSTOMER_HOME.lat, lng: CUSTOMER_HOME.lng }
    }
  });
  const orderId = created.body.order.id;
  await call('/api/payments/intent', { method: 'POST', token: tokens.customer, body: { orderId } });
  const intent = await call('/api/payments/intent', { method: 'POST', token: tokens.customer, body: { orderId } });
  await call('/api/payments/mock/confirm', { method: 'POST', token: tokens.customer, body: { paymentId: intent.body.intent.paymentId } });

  const socket = client(tokens.customer);
  await once(socket, 'realtime:ready');
  const first = await new Promise((resolve) => socket.emit('order:join', { orderId }, resolve));
  assert.equal(first.order.status, 'PAID');
  assert.equal(first.order.statusHistory.map((e) => e.status).join(','), 'PLACED,PAID', 'the whole history arrives with the snapshot');

  // Drop and reconnect: the resync must not depend on what the client remembers.
  socket.close();
  const rebound = client(tokens.customer);
  await once(rebound, 'realtime:ready');
  const second = await new Promise((resolve) => rebound.emit('order:join', { orderId }, resolve));
  assert.equal(second.order.status, 'PAID');
  assert.deepEqual(second.order.statusHistory.map((e) => e.status), first.order.statusHistory.map((e) => e.status));
  rebound.close();
});

test('offers expire and fall through to the next courier without the customer seeing the churn', async () => {
  const restaurant = await Restaurant.findOne({ name: 'Test Kitchen' });
  const other = new User({ phone: '0700000005', name: 'Courier Two', role: 'courier' });
  other.setPassword('gebeta123');
  await other.save();
  await Courier.create({
    userId: other._id,
    name: 'Courier Two',
    vehicle: 'motorbike',
    isOnline: true,
    lastKnownLocation: { type: 'Point', coordinates: [RESTAURANT_AT.lng + 0.004, RESTAURANT_AT.lat + 0.004] },
    locationUpdatedAt: new Date()
  });

  const created = await call('/api/orders', {
    method: 'POST',
    token: tokens.customer,
    body: {
      restaurantId: String(restaurant._id),
      lines: [{ menuItemId: shiroId, qty: 1 }],
      deliveryAddress: { label: 'Home', line: 'Rome St', lat: CUSTOMER_HOME.lat, lng: CUSTOMER_HOME.lng }
    }
  });
  const orderId = created.body.order.id;
  const intent = await call('/api/payments/intent', { method: 'POST', token: tokens.customer, body: { orderId } });
  await call('/api/payments/mock/confirm', { method: 'POST', token: tokens.customer, body: { paymentId: intent.body.intent.paymentId } });
  await call(`/api/restaurant-owner/orders/${orderId}/accept`, { method: 'POST', token: tokens.owner });

  const first = await Order.findById(orderId).lean();
  assert.equal(first.offer.state, 'OFFERED');
  const firstCourierId = String(first.offer.courierId);

  const expired = await assignment.expireOffer(orderId, firstCourierId);
  assert.equal(expired.ok, true, 'the order is re-offered to somebody else');
  const after = await Order.findById(orderId).lean();
  assert.equal(String(after.offer.courierId) === firstCourierId, false, 'the expired courier is not offered again');
  assert.equal(after.offer.attempts.filter((a) => a.reason === 'expired').length, 1);
  assert.equal(after.status, 'PREPARING', 'the customer’s status never changed during the churn');

  await call(`/api/orders/${orderId}/cancel`, { method: 'POST', token: tokens.customer });
});
