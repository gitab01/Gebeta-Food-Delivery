const mongoose = require('mongoose');

/**
 * One code sent to one phone for one purpose. The code itself is never stored: only a
 * bcrypt hash, so a database dump cannot be used to sign somebody up. Codes are short, so
 * they expire quickly and may be guessed only a few times before they are burned.
 */
const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, trim: true, index: true },
    purpose: { type: String, enum: ['register', 'reset'], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: Date
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Mongo removes expired codes on its own; nothing needs to sweep this collection.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
otpSchema.index({ phone: 1, purpose: 1, createdAt: -1 });

otpSchema.methods.isLive = function isLive(at = new Date()) {
  return !this.consumedAt && this.expiresAt.getTime() > at.getTime();
};

module.exports = mongoose.model('OtpCode', otpSchema);
