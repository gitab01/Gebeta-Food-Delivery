const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    cuisine: [
      {
        type: String,
        trim: true,
      },
    ],
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      },
    },
    phone: String,
    email: String,
    logo: String,
    coverImage: String,
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumOrder: {
      type: Number,
      default: 0,
    },
    estimatedDeliveryTime: {
      min: { type: Number, default: 20 },
      max: { type: Number, default: 45 },
    },
    openingHours: {
      monday: { open: String, close: String, closed: Boolean },
      tuesday: { open: String, close: String, closed: Boolean },
      wednesday: { open: String, close: String, closed: Boolean },
      thursday: { open: String, close: String, closed: Boolean },
      friday: { open: String, close: String, closed: Boolean },
      saturday: { open: String, close: String, closed: Boolean },
      sunday: { open: String, close: String, closed: Boolean },
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tags: [String],
  },
  { timestamps: true }
);

// Geo index for location-based queries
restaurantSchema.index({ 'address.coordinates': '2dsphere' });
restaurantSchema.index({ name: 'text', cuisine: 'text', tags: 'text' });

module.exports = mongoose.model('Restaurant', restaurantSchema);
