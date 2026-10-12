const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['restaurant', 'courier'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    stars: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' }
  },
  { timestamps: true }
);

ratingSchema.index({ orderId: 1, targetType: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
