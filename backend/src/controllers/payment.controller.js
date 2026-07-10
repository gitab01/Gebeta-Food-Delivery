const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

// @desc    Create payment intent
// @route   POST /api/payments/intent
exports.createPaymentIntent = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Amount in cents (ETB to USD approximation — replace with real exchange or use ETB if supported)
    const amountInCents = Math.round(order.pricing.total * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd', // Change to 'etb' if Stripe supports it in your region
      metadata: {
        orderId: orderId,
        orderNumber: order.orderNumber,
        customerId: req.user.id,
      },
    });

    // Save payment intent ID
    order.payment.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Stripe webhook handler
// @route   POST /api/payments/webhook
exports.webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody || req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { orderId } = paymentIntent.metadata;

    await Order.findByIdAndUpdate(orderId, {
      'payment.status': 'paid',
    });

    console.log(`✅ Payment successful for order ${orderId}`);
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    const { orderId } = paymentIntent.metadata;

    await Order.findByIdAndUpdate(orderId, {
      'payment.status': 'failed',
    });

    console.log(`❌ Payment failed for order ${orderId}`);
  }

  res.json({ received: true });
};
