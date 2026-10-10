const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const paymentService = require('../services/payment');
const { orderPublicView } = require('../services/serialize');
const env = require('../config/env');

const router = express.Router();

router.post(
  '/intent',
  requireAuth,
  requireRole('customer'),
  asyncHandler(async (req, res) => {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: { code: 'VALIDATION', message: 'orderId is required' } });
    const intent = await paymentService.createIntent(orderId, req.user);
    res.json({ intent, gateway: env.gateway });
  })
);

/**
 * Stands in for the gateway's webhook in development. It is refused outright once
 * a live gateway is configured, so no client can talk an order into PAID.
 */
router.post(
  '/mock/confirm',
  requireAuth,
  requireRole('customer'),
  asyncHandler(async (req, res) => {
    if (env.gateway !== 'mock') {
      return res.status(410).json({ error: { code: 'MOCK_GATEWAY_DISABLED', message: 'A live payment gateway is configured' } });
    }
    const { paymentId } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: { code: 'VALIDATION', message: 'paymentId is required' } });
    const { order, alreadySettled } = await paymentService.confirmMock(paymentId, req.user);
    res.json({ order: orderPublicView(await order.populate('restaurantId')), alreadySettled });
  })
);

module.exports = router;

/** Signature-verified gateway callback — the only production path to PAID. */
const webhookRouter = express.Router();
webhookRouter.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    if (env.gateway !== 'stripe') {
      return res.status(400).json({ error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Set PAYMENT_GATEWAY=stripe and STRIPE_SECRET_KEY to accept gateway callbacks' } });
    }
    let event;
    try {
      event = paymentService.verifyStripeEvent(req.body, req.headers['stripe-signature']);
    } catch (err) {
      return res.status(400).json({ error: { code: 'BAD_SIGNATURE', message: err.message } });
    }
    const result = await paymentService.applyStripeEvent(event);
    res.json({ received: true, ...result });
  })
);

module.exports.webhookRouter = webhookRouter;
module.exports.stripeWebhookPath = '/webhooks/stripe';
