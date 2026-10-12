const mongoose = require('mongoose');

const courierSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    vehicle: { type: String, enum: ['foot', 'bicycle', 'motorbike', 'car'], default: 'motorbike' },
    licencePlate: { type: String, default: '' },
    insuranceProvider: { type: String, default: '' },
    insuranceExpiresAt: Date,
    isOnline: { type: Boolean, default: false, index: true },
    activeOrders: { type: Number, default: 0 },
    lastKnownLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [38.7578, 9.0107] } // [lng, lat] — Addis Ababa centre
    },
    locationUpdatedAt: Date,
    ratingStars: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedDeliveries: { type: Number, default: 0 },
    cancelledByCourier: { type: Number, default: 0 },
    earningsCents: { type: Number, default: 0 },
    payoutPendingCents: { type: Number, default: 0 }
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

courierSchema.index({ lastKnownLocation: '2dsphere' });
courierSchema.index({ isOnline: 1, activeOrders: 1 });

module.exports = mongoose.model('Courier', courierSchema);
