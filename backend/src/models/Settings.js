const mongoose = require('mongoose');

/**
 * Operator preferences, one document. These are the switches the admin settings panel
 * shows; nothing here is a secret - a Google Maps key belongs in each client's own
 * environment, never in a document an authenticated admin can read back.
 */
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ['default'], default: 'default', unique: true },
    currency: { type: String, default: 'ETB' },
    language: { type: String, enum: ['en', 'am', 'ti', 'om'], default: 'en' },
    timezone: { type: String, default: 'Africa/Addis_Ababa' },
    dateFormat: { type: String, default: 'DD MMM YYYY' },
    mapsEnabled: { type: Boolean, default: true },
    notifyNewOrder: { type: Boolean, default: true },
    notifyCourierOffline: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    supportContact: { type: String, default: '' }
  },
  { timestamps: true }
);

settingsSchema.statics.load = async function load() {
  const existing = await this.findOne({ key: 'default' });
  if (existing) return existing;
  try {
    return await this.create({ key: 'default' });
  } catch {
    return this.findOne({ key: 'default' });
  }
};

module.exports = mongoose.model('Settings', settingsSchema);
