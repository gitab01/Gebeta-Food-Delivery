const crypto = require('crypto');
const env = require('../config/env');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { STATUS, ACTOR } = require('./status');

/**
 * Order status reaches PAID through exactly one door: `markPaid`, which is called
 * by the gateway confirmation path (a verified Stripe webhook, or the local mock
 * gateway that stands in for it in development). A client can never claim payment.
 */
async function markPaid({ orderId, gatewayRef, method, raw = {} }) {
  const payment = await Payment.findOne({ orderId });
  if (!payment) throw Object.assign(new Error('No payment intent for this order'), { status: 409 });
  if (payment.status === 'succeeded') {
    const order = await Order.findById(orderId);
    return { order, alreadySettled: true };
  }

  payment.status = 'succeeded';
  payment.gatewayRef = gatewayRef || payment.gatewayRef;
  payment.method = method || payment.method;
  payment.confirmedAt = new Date();
  payment.raw = raw;
  await payment.save();

  const { transition } = require('./orderService');
  const { order } = await transition(orderId, {
    to: STATUS.PAID,
    actor: ACTOR.SYSTEM,
    note: `${payment.gateway} confirmed ${payment.amountCents / 100} ${payment.currency}`
  });
  return { order, alreadySettled: false };
}

async function createIntent(orderId, customer) {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.customerId) !== String(customer._id)) throw Object.assign(new Error('Not your order'), { status: 403 });
  if (order.status !== STATUS.PLACED) {
    throw Object.assign(new Error(`Order is already ${order.status}`), { status: 409 });
  }

  let payment = await Payment.findOne({ orderId });
  if (!payment) {
    payment = await Payment.create({
      orderId,
      customerId: customer._id,
      amountCents: order.totalCents,
      gateway: env.gateway,
      method: env.gateway === 'stripe' ? 'card' : 'mock',
      status: 'requires_payment'
    });
  }

  if (env.gateway === 'stripe') {
    let stripe;
    try {
      stripe = require('stripe')(env.stripeSecretKey); // eslint-disable-line global-require
    } catch (err) {
      throw Object.assign(new Error('PAYMENT_GATEWAY_UNAVAILABLE: install the stripe package and set STRIPE_SECRET_KEY'), { status: 503 });
    }
    const intent = await stripe.paymentIntents.create({
      amount: order.totalCents,
      currency: 'etb',
      metadata: { orderId: String(order._id), customerId: String(customer._id) },
      automatic_payment_methods: { enabled: true }
    });
    payment.gatewayRef = intent.id;
    payment.status = 'requires_action';
    await payment.save();
    return { gateway: 'stripe', paymentId: intent.id, clientSecret: intent.client_secret, amountCents: order.totalCents, publishableKey: env.stripePublishableKey };
  }

  payment.status = 'processing';
  payment.gatewayRef = `mock_${crypto.randomBytes(9).toString('hex')}`;
  await payment.save();
  return {
    gateway: 'mock',
    paymentId: payment.gatewayRef,
    amountCents: order.totalCents,
    currency: payment.currency,
    confirmUrl: `/api/payments/mock/confirm`,
    note: 'Local gateway stand-in. Confirm it to move the order to PAID, exactly as a verified webhook would.'
  };
}

/** Development-only confirmation of the mock gateway. Still requires the order owner's token. */
async function confirmMock(paymentId, customer) {
  const payment = await Payment.findOne({ gatewayRef: paymentId });
  if (!payment) throw Object.assign(new Error('Unknown payment'), { status: 404 });
  if (String(payment.customerId) !== String(customer._id)) throw Object.assign(new Error('Not your payment'), { status: 403 });
  if (payment.gateway !== 'mock') throw Object.assign(new Error('This order was taken by a live gateway'), { status: 409 });
  return markPaid({ orderId: payment.orderId, gatewayRef: payment.gatewayRef, method: payment.method, raw: { confirmedBy: 'mock-gateway' } });
}

function verifyStripeEvent(rawBody, signature) {
  if (!env.stripeWebhookSecret || !signature) {
    throw Object.assign(new Error('Missing webhook signature'), { status: 400 });
  }
  const stripe = require('stripe')(env.stripeSecretKey); // eslint-disable-line global-require
  return stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
}

/** Applies a verified gateway event. Returns 200-fast for duplicates. */
async function applyStripeEvent(event) {
  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object;
    const orderId = intent.metadata?.orderId;
    if (!orderId) return { ignored: true };
    if (event.type === 'payment_intent.payment_failed') {
      await Payment.findOneAndUpdate({ orderId }, { status: 'failed', failureReason: intent.last_payment_error?.message || 'declined' });
      return { ok: true, status: 'failed' };
    }
    await markPaid({ orderId, gatewayRef: intent.id, method: 'card', raw: { eventId: event.id } });
    return { ok: true, status: 'succeeded' };
  }
  return { ignored: true, type: event.type };
}

module.exports = { createIntent, confirmMock, markPaid, applyStripeEvent, verifyStripeEvent };
