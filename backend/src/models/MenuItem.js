const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    description: {
      type: String,
      maxlength: 300,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    image: String,
    customizations: [
      {
        name: String, // e.g. "Size", "Extras"
        required: { type: Boolean, default: false },
        options: [
          {
            label: String,
            price: { type: Number, default: 0 },
          },
        ],
      },
    ],
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isVegetarian: {
      type: Boolean,
      default: false,
    },
    isSpicy: {
      type: Boolean,
      default: false,
    },
    preparationTime: {
      type: Number, // minutes
      default: 15,
    },
    calories: Number,
  },
  { timestamps: true }
);

menuItemSchema.index({ restaurant: 1, category: 1 });
menuItemSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('MenuItem', menuItemSchema);
