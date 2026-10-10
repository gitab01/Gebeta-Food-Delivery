const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEta, rollingPrepMinutes } = require('../src/services/eta');
const { STATUS } = require('../src/services/status');

const NOW = new Date('2026-10-08T12:00:00.000Z');
const RESTAURANT = {
  basePrepMinutes: 20,
  rollingPrepMinutes: 24,
  location: { type: 'Point', coordinates: [38.7578, 9.0089] }
};
const ORDER = {
  deliveryAddress: { lat: 9.0279, lng: 38.7945 },
  prepStartedAt: null
};
const COURIER = { vehicle: 'motorbike', lastKnownLocation: { coordinates: [38.7596, 9.0121] } };

test('the estimate is built from the kitchen’s rolling average, not its promise', () => {
  const eta = buildEta({ now: NOW, status: STATUS.PAID, order: ORDER, restaurant: RESTAURANT });
  assert.ok(eta.minutes >= 24, `uses 24 min average, got ${eta.minutes}`);
  assert.match(eta.reason, /24 min average/);
});

test('PREPARING shortens as the kitchen cooks and lengthens when it runs past its average', () => {
  const justStarted = buildEta({ now: NOW, status: STATUS.PREPARING, order: { ...ORDER, prepStartedAt: NOW }, restaurant: RESTAURANT });
  const halfDone = buildEta({
    now: NOW,
    status: STATUS.PREPARING,
    order: { ...ORDER, prepStartedAt: new Date(NOW.getTime() - 15 * 60000) },
    restaurant: RESTAURANT
  });
  const atAverage = buildEta({
    now: NOW,
    status: STATUS.PREPARING,
    order: { ...ORDER, prepStartedAt: new Date(NOW.getTime() - 24 * 60000) },
    restaurant: RESTAURANT
  });
  const pastBy10 = buildEta({
    now: NOW,
    status: STATUS.PREPARING,
    order: { ...ORDER, prepStartedAt: new Date(NOW.getTime() - 34 * 60000) },
    restaurant: RESTAURANT
  });
  const pastBy30 = buildEta({
    now: NOW,
    status: STATUS.PREPARING,
    order: { ...ORDER, prepStartedAt: new Date(NOW.getTime() - 54 * 60000) },
    restaurant: RESTAURANT
  });
  assert.ok(halfDone.minutes < justStarted.minutes, 'progress pulls the ETA in');
  assert.ok(pastBy10.minutes > atAverage.minutes, 'crossing the average starts the climb');
  assert.ok(pastBy30.minutes > pastBy10.minutes, 'a deeper overrun is admitted, not pinned at a floor');
  assert.match(pastBy30.reason, /running 30 min past/, 'the customer is told why it moved');
  assert.ok(new Date(pastBy30.at) > new Date(pastBy10.at), 'the promised arrival moves later with the overrun');
});

test('READY drops prep time and adds the courier’s approach', () => {
  const ready = buildEta({ now: NOW, status: STATUS.READY, order: ORDER, restaurant: RESTAURANT, courier: COURIER });
  assert.match(ready.reason, /Food is ready/);
  assert.ok(ready.minutes > 0 && ready.minutes < 45, `sane ready-stage estimate: ${ready.minutes}`);
});

test('PICKED_UP is driven by how far the courier is from the drop-off', () => {
  const nearCustomer = buildEta({
    now: NOW,
    status: STATUS.PICKED_UP,
    order: ORDER,
    restaurant: RESTAURANT,
    courier: COURIER,
    courierLocation: { lat: 9.0265, lng: 38.7921 }
  });
  const stillAtRestaurant = buildEta({
    now: NOW,
    status: STATUS.PICKED_UP,
    order: ORDER,
    restaurant: RESTAURANT,
    courier: COURIER,
    courierLocation: { lat: 9.0089, lng: 38.7578 }
  });
  assert.ok(nearCustomer.minutes < stillAtRestaurant.minutes, 'closing the distance closes the ETA');
});

test('a courier without a reported position does not produce a bogus ETA', () => {
  const eta = buildEta({ now: NOW, status: STATUS.PICKED_UP, order: ORDER, restaurant: RESTAURANT, courier: COURIER, courierLocation: null });
  assert.equal(Number.isFinite(eta.minutes), true);
  assert.ok(eta.minutes >= 1);
});

test('delivered orders report zero remaining, not a stale countdown', () => {
  const eta = buildEta({ now: NOW, status: STATUS.DELIVERED, order: ORDER, restaurant: RESTAURANT });
  assert.equal(eta.minutes, 0);
  assert.equal(eta.reason, 'Delivered');
});

test('rolling average needs three samples before it overrides the kitchen’s own number', () => {
  assert.equal(rollingPrepMinutes([], 20), 20);
  assert.equal(rollingPrepMinutes([10, 12], 20), 20);
  assert.equal(rollingPrepMinutes([10, 12, 50], 20), 24);
});

test('absurd prep samples are discarded', () => {
  assert.equal(rollingPrepMinutes([0, 0, 0, 0], 20), 20);
  assert.equal(rollingPrepMinutes([9999, 9999, 9999], 20), 20);
});
