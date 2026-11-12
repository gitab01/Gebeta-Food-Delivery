const env = require('../config/env');
const Courier = require('../models/Courier');
const CourierDocument = require('../models/CourierDocument');

const DOCUMENT_TYPES = ['national_id', 'passport', 'driving_licence'];

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

/**
 * A photo arrives as a data URI because the apps post JSON everywhere else and there is no
 * object store to hand a URL to. Everything about it is distrusted: the declared type, the
 * base64 itself, the real decoded length and the fact that two sides are actually different
 * pictures of one card.
 */
function decodePhoto(raw, side) {
  const text = String(raw || '');
  const match = /^data:image\/(jpeg|jpg|png);base64,([\s\S]+)$/.exec(text);
  if (!match) {
    throw fail(400, 'DOCUMENT_FORMAT', `The ${side} of the document must be a JPEG or PNG photo.`);
  }
  let data;
  try {
    data = Buffer.from(match[2], 'base64');
  } catch {
    throw fail(400, 'DOCUMENT_FORMAT', `The ${side} photo could not be read.`);
  }
  if (!data.length) throw fail(400, 'DOCUMENT_EMPTY', `The ${side} photo is empty.`);
  if (data.length > env.courierDocMaxBytes) {
    throw fail(413, 'DOCUMENT_TOO_LARGE', `Each photo must be under ${Math.round(env.courierDocMaxBytes / 1024 / 1024)} MB. Retake it closer to the card.`);
  }
  return {
    contentType: match[1] === 'jpg' ? 'image/jpeg' : `image/${match[1]}`,
    bytes: data.length,
    data,
    capturedAt: new Date()
  };
}

/**
 * Decodes both sides of the document and says whether they are usable. Pure: nothing is
 * written, so a caller can try this before it creates any rows.
 */
function readPhotos({ documentType, front, back }) {
  if (!DOCUMENT_TYPES.includes(documentType)) {
    throw fail(400, 'DOCUMENT_TYPE', `documentType must be one of ${DOCUMENT_TYPES.join(', ')}`);
  }
  const photos = { front: decodePhoto(front, 'front'), back: decodePhoto(back, 'back') };
  if (photos.front.data.equals(photos.back.data)) {
    throw fail(400, 'DOCUMENT_SIDES', 'The front and back photos are identical. Both sides of the document are needed.');
  }
  return photos;
}

/**
 * Files (or re-files) a courier's papers. A review always starts at `pending`, including after a
 * rejection, so a courier who resubmits cannot be left holding an old decision.
 */
async function storePhotos({ courier, user, documentType, photos }) {
  const doc = await CourierDocument.findOneAndUpdate(
    { courierId: courier._id },
    { userId: user._id, documentType, front: photos.front, back: photos.back },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  courier.verification = {
    ...courier.verification,
    status: 'pending',
    documentType,
    submittedAt: new Date(),
    reviewNote: ''
  };
  courier.isOnline = false;
  await courier.save();
  return { courier, doc };
}

async function submitDocuments({ courier, user, documentType, front, back }) {
  const photos = readPhotos({ documentType, front, back });
  return storePhotos({ courier, user, documentType, photos });
}

/** The admin's decision. Rejection also takes the courier off the road immediately. */
async function review({ courierId, decision, note = '', adminId }) {
  if (!['approve', 'reject'].includes(decision)) throw fail(400, 'VALIDATION', 'decision must be approve or reject');
  const courier = await Courier.findById(courierId);
  if (!courier) throw fail(404, 'NOT_FOUND', 'Courier not found');
  if (decision === 'reject' && !String(note || '').trim()) {
    throw fail(400, 'REASON_REQUIRED', 'A rejected courier has to be told why, so the note is required.');
  }

  courier.verification.status = decision === 'approve' ? 'approved' : 'rejected';
  courier.verification.reviewedAt = new Date();
  courier.verification.reviewedBy = adminId;
  courier.verification.reviewNote = String(note || '').trim().slice(0, 400);
  if (decision === 'reject') courier.isOnline = false;
  await courier.save();
  return courier;
}

/** What the courier is shown about their own file — no photo bytes, no admin internals. */
function statusView(courier, doc) {
  const v = courier.verification || {};
  return {
    status: v.status || 'pending',
    documentType: v.documentType || '',
    submittedAt: v.submittedAt || null,
    reviewedAt: v.reviewedAt || null,
    reviewNote: v.reviewNote || '',
    hasFront: Boolean(doc?.front?.bytes),
    hasBack: Boolean(doc?.back?.bytes),
    photoBytes: (doc?.front?.bytes || 0) + (doc?.back?.bytes || 0)
  };
}

/** Only an approved courier may hold a job; everything else is decided here, once. */
const mayWork = (courier) => courier?.verification?.status === 'approved';

module.exports = { DOCUMENT_TYPES, readPhotos, storePhotos, submitDocuments, review, statusView, mayWork };
