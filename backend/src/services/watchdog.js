const env = require('../config/env');
const Order = require('../models/Order');
const { STATUS } = require('./status');
const { refreshEta } = require('./orderService');

let timer = null;
let lastSweepAt = null;

/**
 * The orphaned order is the failure this whole system exists to prevent: a kitchen
 * has accepted, food is cooking, and no courier will ever see it. Anything sitting
 * in PREPARING/READY past the threshold gets assignment re-opened with a wider radius,
 * and the ETA is recomputed so the customer sees the truth rather than a stale promise.
 */
async function sweep() {
  const assignment = require('./assignment');
  const bus = require('../realtime/bus');
  const cutoff = new Date(Date.now() - env.orphanAfterMs);
  lastSweepAt = new Date();

  const orphans = await Order.find({
    status: { $in: [STATUS.PREPARING, STATUS.READY] },
    courierId: null,
    $or: [{ acceptedAt: { $lte: cutoff } }, { paidAt: { $lte: cutoff }, acceptedAt: null }]
  }).select('_id status offer eta acceptedAt').lean();

  const results = [];
  for (const order of orphans) {
    const live = await Order.findById(order._id).select('offer status courierId').lean();
    if (!live || live.courierId || live.offer?.state === 'OFFERED') continue;
    const outcome = await assignment.offerFor(order._id, { reason: 'watchdog' });
    await refreshEta(order._id, { force: true });
    results.push({ orderId: String(order._id), ...outcome });
  }
  if (results.length) bus.notifyAdmin('watchdog:sweep', { at: lastSweepAt, orphans: results });
  return results;
}

/** Keep ETAs honest between transitions: recompute active orders on a cadence. */
async function refreshActiveEtas() {
  const active = await Order.find({ status: { $in: [STATUS.PAID, STATUS.PREPARING, STATUS.READY, STATUS.ASSIGNED, STATUS.PICKED_UP] } })
    .select('_id')
    .lean();
  for (const order of active) await refreshEta(order._id);
  return active.length;
}

function startWatchdog({ intervalMs = env.watchdogIntervalMs } = {}) {
  if (timer) return timer;
  timer = setInterval(() => {
    sweep().catch((err) => console.error('[watchdog]', err.message));
    refreshActiveEtas().catch((err) => console.error('[eta-refresh]', err.message));
  }, intervalMs);
  timer.unref?.();
  return timer;
}

function stopWatchdog() {
  if (timer) clearInterval(timer);
  timer = null;
}

const status = () => ({ running: Boolean(timer), intervalMs: env.watchdogIntervalMs, orphanAfterMs: env.orphanAfterMs, lastSweepAt });

module.exports = { sweep, refreshActiveEtas, startWatchdog, stopWatchdog, status };
