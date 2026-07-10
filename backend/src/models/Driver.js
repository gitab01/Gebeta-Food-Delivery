const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    vehicle: {
      type: { type: String, enum: ['bicycle', 'motorcycle', 'car'], required: true },
      plateNumber: String,
      model: String,
      color: String,
    },
    licenseNumber: {
      type: String,
      required: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: [0, 0],
      },
    },
    currentOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    stats: {
      totalDeliveries: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
      rating: { type: Number, default: 0, min: 0, max: 5 },
      ratingCount: { type: Number, default: 0 },
    },
    documents: {
      idCard: String,
      driverLicense: String,
      vehicleRegistration: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    bankDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
    },
  },
  { timestamps: true }
);

driverSchema.index({ currentLocation: '2dsphere' });
driverSchema.index({ isOnline: 1, isAvailable: 1 });

module.exports = mongoose.model('Driver', driverSchema);
