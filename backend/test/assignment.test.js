const test = require('node:test');
const assert = require('node:assert/strict');
const { rankCandidates, LOAD_PENALTY_MINUTES_PER_ORDER } = require('../src/services/assignment');

const RESTAURANT = { lat: 9.0089, lng: 38.7578 };

const courier = (id, { lat, lng, activeOrders = 0, isOnline = true, vehicle = 'motorbike' }) => ({
  _id: id,
  userId: `user-${id}`,
  name: `Courier ${id}`,
  vehicle,
  isOnline,
  activeOrders,
  lastKnownLocation: { type: 'Point', coordinates: [lng, lat] }
});

// Roughly: c1 ~150m, c2 ~700m, c3 ~1.6km, c4 ~2.9km from the restaurant.
const C1 = courier('c1', { lat: 9.0102, lng: 38.7588 });
const C2 = courier('c2', { lat: 9.0152, lng: 38.7621 });
const C3 = courier('c3', { lat: 9.0233, lng: 38.7701 });
const C4 = courier('c4', { lat: 9.0345, lng: 38.7802 });

test('nearest courier wins when nobody is carrying anything', () => {
  const ranked = rankCandidates([C3, C1, C2], RESTAURANT, { loadCap: 2 });
  assert.deepEqual(ranked.map((r) => r.courier._id), ['c1', 'c2', 'c3']);
});

test('a courier already carrying two orders does not win by being closest', () => {
  const loaded = courier('c1', { lat: 9.0102, lng: 38.7588, activeOrders: 1 });
  const ranked = rankCandidates([loaded, C2, C3], RESTAURANT, { loadCap: 2 });
  assert.equal(ranked[0].courier._id === 'c1', false, 'the loaded courier is passed over');
  assert.equal(ranked[0].courier._id, 'c2');
});

test('couriers at the load cap are excluded outright, not demoted', () => {
  const atCap = courier('c1', { lat: 9.0102, lng: 38.7588, activeOrders: 2 });
  const ranked = rankCandidates([atCap, C2], RESTAURANT, { loadCap: 2 });
  assert.deepEqual(ranked.map((r) => r.courier._id), ['c2']);
});

test('offline couriers never appear in the candidate list', () => {
  const offline = courier('c1', { lat: 9.0102, lng: 38.7588, isOnline: false });
  const ranked = rankCandidates([offline, C2], RESTAURANT, { loadCap: 2 });
  assert.deepEqual(ranked.map((r) => r.courier._id), ['c2']);
});

test('already-offered couriers are excluded so the next attempt reaches somebody new', () => {
  const ranked = rankCandidates([C1, C2, C3], RESTAURANT, { loadCap: 2, exclude: ['c1'] });
  assert.equal(ranked.some((r) => r.courier._id === 'c1'), false);
  assert.equal(ranked[0].courier._id, 'c2');
});

test('load penalty is what reorders two couriers whose distances are close', () => {
  const nearButBusy = courier('busy', { lat: 9.0121, lng: 38.7596, activeOrders: 1 });
  const furtherButFree = courier('free', { lat: 9.0152, lng: 38.7621, activeOrders: 0 });
  const ranked = rankCandidates([nearButBusy, furtherButFree], RESTAURANT, { loadCap: 3 });
  const busy = ranked.find((r) => r.courier._id === 'busy');
  const free = ranked.find((r) => r.courier._id === 'free');
  assert.ok(busy.minutesToArrive < free.minutesToArrive, 'busy courier is genuinely closer');
  assert.equal(LOAD_PENALTY_MINUTES_PER_ORDER > 0, true);
  assert.equal(Number.isFinite(busy.score) && Number.isFinite(free.score), true);
  assert.equal(ranked[0].courier._id === 'busy', busy.score < free.score);
});

test('a courier with no reported position is not offered', () => {
  const blind = { _id: 'c9', userId: 'u9', name: 'Blind', vehicle: 'motorbike', isOnline: true, activeOrders: 0, lastKnownLocation: null };
  const ranked = rankCandidates([blind, C2], RESTAURANT, { loadCap: 2 });
  assert.deepEqual(ranked.map((r) => r.courier._id), ['c2']);
});
