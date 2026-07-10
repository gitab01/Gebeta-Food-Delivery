const express = require('express');
const router = express.Router();
const { createPaymentIntent, webhook } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth');

// Stripe webhook (raw body needed)
router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// Create payment intent
router.post('/intent', protect, createPaymentIntent);

module.exports = router;
