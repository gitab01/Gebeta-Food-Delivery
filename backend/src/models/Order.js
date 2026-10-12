const mongoose = require('mongoose');

const orderedItemSchema = new mongoose.Schema(
  {
    menuItemId: mongoose.Schema.Types.ObjectId,
    name: String,
    emoji: String,
    qty: { type: Number, min: 1, default: 1 },
    unitPriceCents: { type: Number, min: 0 },
    lineTotalCents: { type: Number, min: 0 }
  },
  { _id: false }
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    actor: { type: String, default: 'system' },
    actorId: mongoose.Schema.Types.ObjectId,
    note: { type: String, default: '' }
  },
  { _id: false }
);

const offerAttemptSchema = new mongoose.Schema(
  {
    courierId: mongoose.Schema.Types.ObjectId,
    courierName: String,
    reason: { type: String, enum: ['accepted', 'declined', 'expired', 'unreachable', 'no_candidates'] },
    distanceMeters: Number,
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const trailPointSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number,
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier', default: null, index: true },
    courierUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    items: { type: [orderedItemSchema], validate: (v) => Array.isArray(v) && v.length > 0 },
    subtotalCents: { type: Number, required: true, min: 0 },
    deliveryFeeCents: { type: Number, default: 0 },
    serviceFeeCents: { type: Number, default: 0 },
    totalCents: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ['PLACED', 'PAID', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED', 'REJECTED', 'CANCELLED'],
      default: 'PLACED',
      index: true
    },
    statusHistory: { type: [statusEventSchema], default: [] },

    offer: {
      state: { type: String, enum: ['NONE', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'EXHAUSTED'], default: 'NONE' },
      courierId: mongoose.Schema.Types.ObjectId,
      courierUserId: mongoose.Schema.Types.ObjectId,
      courierName: String,
      offeredAt: Date,
      expiresAt: Date,
      radiusMeters: Number,
      attempts: { type: [offerAttemptSchema], default: [] }
    },

    eta: {
      minutes: Number,
      at: Date,
      reason: String,
      computedAt: { type: Date, default: Date.now }
    },

    deliveryAddress: {
      label: String,
      line: String,
      city: String,
      lat: Number,
      lng: Number
    },
    contactPhone: { type: String, default: '' },
    notes: { type: String, default: '' },
    courierTrail: { type: [trailPointSchema], default: [] },

    distanceMeters: Number,
    placedAt: { type: Date, default: Date.now },
    paidAt: Date,
    acceptedAt: Date,
    prepStartedAt: Date,
    readyAt: Date,
    assignedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    completedAt: Date,
    closedAt: Date,
    rejectReason: String,
    cancelReason: String,

    courierFeeCents: { type: Number, default: 0 },
    restaurantPayoutCents: { type: Number, default: 0 },
    rated: {
      restaurant: { type: Boolean, default: false },
      courier: { type: Boolean, default: false }
    },
    customerRatingStars: Number,
    courierRatingStars: Number
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

orderSchema.index({ restaurantId: 1, status: 1 });
orderSchema.index({ courierId: 1, status: 1 });

orderSchema.virtual('timeline').get(function timeline() {
  return this.statusHistory.map((e) => ({ status: e.status, at: e.at, actor: e.actor, note: e.note }));
});

/** Append a status event. History is append-only: never mutated, never removed. */
orderSchema.methods.recordStatus = function recordStatus(status, { actor = 'system', actorId = null, note = '' } = {}) {
  this.statusHistory.push({ status, at: new Date(), actor, actorId, note });
  this.status = status;
  return this;
};

module.exports = mongoose.model('Order', orderSchema);
