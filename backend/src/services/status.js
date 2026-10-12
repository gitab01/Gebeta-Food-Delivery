/**
 * The order lifecycle, in one place. Every write path goes through
 * `assertTransition` before the document is saved, and the realtime emit happens
 * after the save — so a broadcast can never describe a state that was not written.
 */

const STATUS = {
  PLACED: 'PLACED',
  PAID: 'PAID',
  PREPARING: 'PREPARING',
  READY: 'READY',
  ASSIGNED: 'ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
};

const ACTOR = { CUSTOMER: 'customer', RESTAURANT: 'restaurant', COURIER: 'courier', SYSTEM: 'system' };

const TRANSITIONS = {
  [STATUS.PLACED]: [STATUS.PAID, STATUS.CANCELLED],
  [STATUS.PAID]: [STATUS.PREPARING, STATUS.REJECTED, STATUS.CANCELLED],
  [STATUS.PREPARING]: [STATUS.READY, STATUS.ASSIGNED, STATUS.CANCELLED],
  [STATUS.READY]: [STATUS.ASSIGNED, STATUS.PICKED_UP, STATUS.CANCELLED],
  [STATUS.ASSIGNED]: [STATUS.READY, STATUS.PICKED_UP, STATUS.CANCELLED],
  [STATUS.PICKED_UP]: [STATUS.DELIVERED],
  [STATUS.DELIVERED]: [STATUS.COMPLETED],
  [STATUS.COMPLETED]: [],
  [STATUS.REJECTED]: [],
  [STATUS.CANCELLED]: []
};

// Who is allowed to request each edge. `system` covers webhooks and the watchdog.
const EDGE_ACTORS = {
  [`${STATUS.PLACED}>${STATUS.PAID}`]: [ACTOR.CUSTOMER, ACTOR.SYSTEM],
  [`${STATUS.PLACED}>${STATUS.CANCELLED}`]: [ACTOR.CUSTOMER, ACTOR.SYSTEM],
  [`${STATUS.PAID}>${STATUS.PREPARING}`]: [ACTOR.RESTAURANT, ACTOR.SYSTEM],
  [`${STATUS.PAID}>${STATUS.REJECTED}`]: [ACTOR.RESTAURANT, ACTOR.SYSTEM],
  [`${STATUS.PAID}>${STATUS.CANCELLED}`]: [ACTOR.CUSTOMER, ACTOR.SYSTEM],
  [`${STATUS.PREPARING}>${STATUS.READY}`]: [ACTOR.RESTAURANT, ACTOR.SYSTEM],
  [`${STATUS.PREPARING}>${STATUS.ASSIGNED}`]: [ACTOR.COURIER, ACTOR.SYSTEM],
  [`${STATUS.PREPARING}>${STATUS.CANCELLED}`]: [ACTOR.CUSTOMER, ACTOR.SYSTEM],
  [`${STATUS.READY}>${STATUS.ASSIGNED}`]: [ACTOR.COURIER, ACTOR.SYSTEM],
  [`${STATUS.READY}>${STATUS.PICKED_UP}`]: [ACTOR.COURIER, ACTOR.SYSTEM],
  [`${STATUS.READY}>${STATUS.CANCELLED}`]: [ACTOR.CUSTOMER, ACTOR.SYSTEM],
  [`${STATUS.ASSIGNED}>${STATUS.READY}`]: [ACTOR.RESTAURANT, ACTOR.SYSTEM],
  [`${STATUS.ASSIGNED}>${STATUS.PICKED_UP}`]: [ACTOR.COURIER, ACTOR.SYSTEM],
  [`${STATUS.ASSIGNED}>${STATUS.CANCELLED}`]: [ACTOR.CUSTOMER, ACTOR.SYSTEM],
  [`${STATUS.PICKED_UP}>${STATUS.DELIVERED}`]: [ACTOR.COURIER, ACTOR.SYSTEM],
  [`${STATUS.DELIVERED}>${STATUS.COMPLETED}`]: [ACTOR.CUSTOMER, ACTOR.SYSTEM]
};

const TERMINAL = [STATUS.COMPLETED, STATUS.REJECTED, STATUS.CANCELLED];
// Statuses in which a courier is expected to still be moving the order.
const ACTIVE_FOR_COURIER = [STATUS.READY, STATUS.ASSIGNED, STATUS.PICKED_UP];
// Statuses that count against a courier's load cap.
const COUNTED_TOWARD_LOAD = [STATUS.READY, STATUS.ASSIGNED, STATUS.PICKED_UP];
// Statuses in which the courier legitimately sees the customer's address and phone.
const ADDRESS_VISIBLE = [STATUS.READY, STATUS.ASSIGNED, STATUS.PICKED_UP, STATUS.DELIVERED];
// Statuses the assignment engine may act on.
const ASSIGNABLE = [STATUS.PREPARING, STATUS.READY];

const OFFER_STATE = {
  NONE: 'NONE',
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  EXHAUSTED: 'EXHAUSTED'
};

class IllegalTransition extends Error {
  constructor(from, to, actor) {
    super(`Illegal order transition ${from} -> ${to}${actor ? ` for actor "${actor}"` : ''}`);
    this.name = 'IllegalTransition';
    this.status = 409;
    this.code = 'ILLEGAL_TRANSITION';
    this.from = from;
    this.to = to;
  }
}

function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

function actorMayTransition(from, to, actor) {
  const allowed = EDGE_ACTORS[`${from}>${to}`] || [];
  return allowed.includes(actor);
}

function assertTransition(from, to, actor) {
  if (!canTransition(from, to)) throw new IllegalTransition(from, to, actor);
  if (actor && !actorMayTransition(from, to, actor)) throw new IllegalTransition(from, to, actor);
  return true;
}

const isTerminal = (status) => TERMINAL.includes(status);
const countsTowardCourierLoad = (status) => COUNTED_TOWARD_LOAD.includes(status);
const addressVisibleToCourier = (status) => ADDRESS_VISIBLE.includes(status);

module.exports = {
  STATUS,
  ACTOR,
  TRANSITIONS,
  EDGE_ACTORS,
  TERMINAL,
  ACTIVE_FOR_COURIER,
  COUNTED_TOWARD_LOAD,
  ADDRESS_VISIBLE,
  ASSIGNABLE,
  OFFER_STATE,
  IllegalTransition,
  canTransition,
  actorMayTransition,
  assertTransition,
  isTerminal,
  countsTowardCourierLoad,
  addressVisibleToCourier
};
