const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const int = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gebeta',
  jwtSecret: process.env.JWT_SECRET || 'gebeta-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()).filter(Boolean),

  // Realtime
  offerTimeoutMs: int(process.env.OFFER_TIMEOUT_MS, 30000),
  offerRetryMs: int(process.env.OFFER_RETRY_MS, 15000),
  courierLoadCap: int(process.env.COURIER_LOAD_CAP, 2),
  assignmentRadiusStartMeters: int(process.env.ASSIGNMENT_RADIUS_START_M, 3000),
  assignmentRadiusStepMeters: int(process.env.ASSIGNMENT_RADIUS_STEP_M, 2500),
  assignmentMaxAttempts: int(process.env.ASSIGNMENT_MAX_ATTEMPTS, 6),
  watchdogIntervalMs: int(process.env.WATCHDOG_INTERVAL_MS, 20000),
  orphanAfterMs: int(process.env.ORPHAN_AFTER_MS, 60000),
  locationThrottleMs: int(process.env.LOCATION_THROTTLE_MS, 10000),
  pickupToleranceMeters: int(process.env.PICKUP_TOLERANCE_M, 400),
  dropoffToleranceMeters: int(process.env.DROPOFF_TOLERANCE_M, 300),

  // Fees, all integer cents
  deliveryFeeCents: int(process.env.DELIVERY_FEE_CENTS, 15000),
  serviceRateBps: int(process.env.SERVICE_RATE_BPS, 500),
  courierFeeCents: int(process.env.COURIER_FEE_CENTS, 12000),
  minOrderCents: int(process.env.MIN_ORDER_CENTS, 10000),

  gateway: process.env.PAYMENT_GATEWAY || (process.env.STRIPE_SECRET_KEY ? 'stripe' : 'mock'),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
};

if (env.nodeEnv === 'production' && env.jwtSecret === 'gebeta-dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = env;
