const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STATUS,
  ACTOR,
  canTransition,
  actorMayTransition,
  assertTransition,
  isTerminal,
  TRANSITIONS
} = require('../src/services/status');

const ALL = Object.values(STATUS);

test('every status declares its outgoing edges', () => {
  for (const status of ALL) {
    assert.ok(Array.isArray(TRANSITIONS[status]), `${status} has a transition list`);
  }
});

test('happy path is legal edge by edge', () => {
  const path = [STATUS.PLACED, STATUS.PAID, STATUS.PREPARING, STATUS.READY, STATUS.ASSIGNED, STATUS.PICKED_UP, STATUS.DELIVERED, STATUS.COMPLETED];
  for (let i = 0; i < path.length - 1; i++) {
    assert.equal(canTransition(path[i], path[i + 1]), true, `${path[i]} -> ${path[i + 1]}`);
  }
});

test('PREPARING may reach ASSIGNED directly — the kitchen accepts before a courier exists', () => {
  assert.equal(canTransition(STATUS.PREPARING, STATUS.ASSIGNED), true);
  assert.equal(canTransition(STATUS.READY, STATUS.ASSIGNED), true);
});

test('illegal transitions are rejected', () => {
  const illegal = [
    [STATUS.PLACED, STATUS.PREPARING],
    [STATUS.PLACED, STATUS.DELIVERED],
    [STATUS.PAID, STATUS.PICKED_UP],
    [STATUS.PICKED_UP, STATUS.COMPLETED],
    [STATUS.DELIVERED, STATUS.PICKED_UP],
    [STATUS.CANCELLED, STATUS.PREPARING],
    [STATUS.REJECTED, STATUS.PAID],
    [STATUS.COMPLETED, STATUS.DELIVERED]
  ];
  for (const [from, to] of illegal) {
    assert.equal(canTransition(from, to), false, `${from} -> ${to} must be illegal`);
  }
});

test('terminal states lead nowhere', () => {
  for (const status of [STATUS.COMPLETED, STATUS.REJECTED, STATUS.CANCELLED]) {
    assert.equal(isTerminal(status), true);
    assert.equal(TRANSITIONS[status].length, 0, `${status} is terminal`);
  }
});

test('role separation: a customer cannot accept or deliver', () => {
  assert.equal(actorMayTransition(STATUS.PAID, STATUS.PREPARING, ACTOR.CUSTOMER), false);
  assert.equal(actorMayTransition(STATUS.PAID, STATUS.PREPARING, ACTOR.RESTAURANT), true);
  assert.equal(actorMayTransition(STATUS.PICKED_UP, STATUS.DELIVERED, ACTOR.CUSTOMER), false);
  assert.equal(actorMayTransition(STATUS.PICKED_UP, STATUS.DELIVERED, ACTOR.COURIER), true);
  assert.equal(actorMayTransition(STATUS.PLACED, STATUS.PAID, ACTOR.CUSTOMER), true);
});

test('assertTransition throws a 409 IllegalTransition with the edge attached', () => {
  assert.throws(
    () => assertTransition(STATUS.PLACED, STATUS.DELIVERED, ACTOR.COURIER),
    (err) => err.name === 'IllegalTransition' && err.status === 409 && err.code === 'ILLEGAL_TRANSITION' && err.from === STATUS.PLACED && err.to === STATUS.DELIVERED
  );
  assert.equal(assertTransition(STATUS.PAID, STATUS.PREPARING, ACTOR.RESTAURANT), true);
});

test('no edge is reachable by an actor that the map forbids', () => {
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    for (const to of targets) {
      const actors = [ACTOR.CUSTOMER, ACTOR.RESTAURANT, ACTOR.COURIER, ACTOR.SYSTEM];
      const permitted = actors.filter((a) => actorMayTransition(from, to, a));
      assert.ok(permitted.length > 0, `${from} -> ${to} has at least one permitted actor`);
      assert.ok(permitted.includes(ACTOR.SYSTEM), `${from} -> ${to} is reachable by the gateway or watchdog`);
    }
  }
});
