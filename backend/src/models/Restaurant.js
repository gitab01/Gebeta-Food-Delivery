const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    priceCents: { type: Number, required: true, min: 0 },
    available: { type: Boolean, default: true },
    prepMinutes: { type: Number, default: 12 },
    emoji: { type: String, default: '🍽' }
  },
  { _id: true }
);

const menuSectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    items: [menuItemSchema]
  },
  { _id: true }
);

const restaurantSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true, trim: true },
    cuisine: { type: [String], default: [] },
    description: { type: String, default: '' },
    emoji: { type: String, default: '🍲' },
    tint: { type: String, default: '#c1121f' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true } // [lng, lat]
    },
    isOpen: { type: Boolean, default: true },
    basePrepMinutes: { type: Number, default: 20 },
    deliveryRadiusMeters: { type: Number, default: 8000 },
    minOrderCents: { type: Number, default: 10000 },
    menu: [menuSectionSchema],
    ratingStars: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
    rollingPrepMinutes: { type: Number, default: 0 }
  },
  { timestamps: true }
);

restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ name: 'text', cuisine: 'text' });

restaurantSchema.virtual('avgPrepMinutes').get(function avgPrepMinutes() {
  return Math.round(this.rollingPrepMinutes || this.basePrepMinutes);
});

restaurantSchema.methods.findMenuItem = function findMenuItem(itemId) {
  for (const section of this.menu) {
    const item = section.items.id(itemId);
    if (item) return { section, item };
  }
  return null;
};

restaurantSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
