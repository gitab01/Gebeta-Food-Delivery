const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'ETB' },
    method: { type: String, enum: ['card', 'telebirr', 'cbebir', 'cash', 'mock'], default: 'mock' },
    gateway: { type: String, enum: ['mock', 'stripe'], default: 'mock' },
    status: {
      type: String,
      enum: ['requires_payment', 'processing', 'requires_action', 'succeeded', 'failed', 'refunded'],
      default: 'requires_payment',
      index: true
    },
    gatewayRef: { type: String, default: '', index: true },
    failureReason: { type: String, default: '' },
    confirmedAt: Date,
    refundedAt: Date,
    raw: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
