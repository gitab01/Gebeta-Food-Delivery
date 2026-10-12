const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Home' },
    line: { type: String, required: true },
    city: { type: String, default: 'Addis Ababa' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    contactPhone: { type: String, default: '' }
  },
  { _id: true }
);

/**
 * A payment choice the customer saved, not card data. Only the brand, a display
 * label, the last four digits and an expiry are stored: a real PAN belongs to the
 * gateway, and the `last4` pattern is what keeps a mistyped full number out of the
 * database.
 */
const paymentMethodSchema = new mongoose.Schema(
  {
    brand: { type: String, enum: ['card', 'telebirr', 'cbebir', 'cash'], required: true },
    label: { type: String, default: '' },
    last4: { type: String, default: '', match: /^\d{0,4}$/ },
    expiryMonth: { type: Number, min: 1, max: 12 },
    expiryYear: { type: Number, min: 2000, max: 2100 },
    isDefault: { type: Boolean, default: false }
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'courier', 'restaurant', 'admin'], default: 'customer', index: true },
    addresses: [addressSchema],
    paymentMethods: [paymentMethodSchema],
    isBlocked: { type: Boolean, default: false },
    lastLoginAt: Date
  },
  { timestamps: true }
);

userSchema.methods.setPassword = function setPassword(plain) {
  this.passwordHash = bcrypt.hashSync(plain, 10);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compareSync(plain, this.passwordHash);
};

userSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
