const mongoose = require('mongoose');

/**
 * The two identity photos behind a courier's verification request. They live in MongoDB, not
 * on disk, because the API's filesystem is reset by every deploy - and they sit in their own
 * collection so the hot Courier queries (dispatch, presence, the courier list) never have to
 * page through a megabyte of image data.
 *
 * Both sides are `select: false`, so a photo leaves this file only when a route asks for it by
 * name. That makes it impossible to leak one through a list endpoint by forgetting a projection.
 */
const imageSchema = new mongoose.Schema(
  {
    contentType: { type: String, enum: ['image/jpeg', 'image/png'], required: true },
    bytes: { type: Number, default: 0 },
    data: { type: Buffer, select: false },
    capturedAt: Date
  },
  { _id: false }
);

const courierDocumentSchema = new mongoose.Schema(
  {
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier', required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    documentType: { type: String, enum: ['national_id', 'passport', 'driving_licence'], required: true },
    front: imageSchema,
    back: imageSchema
  },
  { timestamps: true }
);

module.exports = mongoose.model('CourierDocument', courierDocumentSchema);
