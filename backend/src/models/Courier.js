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
    payoutPendingCents: { type: Number, default: 0 },

    /**
     * A courier account is created by the person themselves, but being allowed to carry
     * money and food is the operator's decision, not theirs. Nothing is approved at signup:
     * the identity photos go in CourierDocument and an admin moves this status.
     */
    verification: {
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
      documentType: { type: String, enum: ['', 'national_id', 'passport', 'driving_licence'], default: '' },
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewNote: { type: String, default: '' }
    }
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

courierSchema.index({ lastKnownLocation: '2dsphere' });
courierSchema.index({ isOnline: 1, activeOrders: 1 });

module.exports = mongoose.model('Courier', courierSchema);
