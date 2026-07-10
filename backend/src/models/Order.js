const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  name: String,
  price: Number,
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  customizations: [
    {
      name: String,
      selectedOption: String,
      additionalPrice: Number,
    },
  ],
  subtotal: Number,
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    items: [orderItemSchema],
    deliveryAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      coordinates: {
        lat: Number,
        lng: Number,
      },
      instructions: String,
    },
    status: {
      type: String,
      enum: [
        'pending',        // Order placed, waiting for restaurant
        'confirmed',      // Restaurant confirmed
        'preparing',      // Restaurant is preparing
        'ready',          // Food ready, looking for driver
        'picked_up',      // Driver picked up the order
        'on_the_way',     // Driver en route to customer
        'delivered',      // Order delivered
        'cancelled',      // Order cancelled
      ],
      default: 'pending',
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
    payment: {
      method: {
        type: String,
        enum: ['card', 'cash', 'wallet'],
        default: 'card',
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      stripePaymentIntentId: String,
      amount: Number,
    },
    pricing: {
      subtotal: Number,
      deliveryFee: Number,
      serviceFee: Number,
      tax: Number,
      total: Number,
      discount: { type: Number, default: 0 },
    },
    estimatedDeliveryTime: Date,
    actualDeliveryTime: Date,
    rating: {
      food: { type: Number, min: 1, max: 5 },
      delivery: { type: Number, min: 1, max: 5 },
      review: String,
    },
    cancellationReason: String,
  },
  { timestamps: true }
);

// Auto-generate order number
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `GBT-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ driver: 1, status: 1 });
orderSchema.index({ restaurant: 1, status: 1 });
orderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model('Order', orderSchema);
