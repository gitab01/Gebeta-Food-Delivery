const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const OtpCode = require('../models/OtpCode');

/**
 * Sending a code goes through one of these. `log` is the default and writes the code to the
 * server console instead of a network: no SMS gateway credentials are needed to run the
 * system, and nothing secret is ever committed. Set SMS_PROVIDER to a real gateway name once
 * one is configured and add its branch here — this is the only place delivery happens.
 */
async function dispatch(phone, code, purpose) {
  if (env.smsProvider === 'log') {
    console.log(`[otp] ${purpose} code for ${phone}: ${code}`);
    return { delivered: true, provider: 'log' };
  }
  throw Object.assign(
    new Error(`SMS_PROVIDER="${env.smsProvider}" has no implementation here yet. Use "log", or add the gateway to services/otp.js.`),
    { status: 503 }
  );
}

const randomCode = () => {
  const digits = '0123456789';
  let out = '';
  while (out.length < env.otpCodeLength) out += digits[crypto.randomInt(0, 10)];
  return out;
};

const fail = (status, code, message, extra = {}) => Object.assign(new Error(message), { status, code, ...extra });

/**
 * Issues a code, having first checked that this phone is not asking too often. Any code still
 * outstanding for the same purpose is burned, so only the newest one can be used.
 */
async function send({ phone, purpose }) {
  const recent = await OtpCode.countDocuments({ phone, purpose, createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } });
  if (recent >= env.otpHourlyCap) {
    throw fail(429, 'OTP_LIMIT', 'Too many codes requested for this number. Try again later.');
  }
  const last = await OtpCode.findOne({ phone, purpose }).sort({ createdAt: -1 });
  if (last && Date.now() - last.createdAt.getTime() < env.otpResendAfterMs) {
    const waitMs = env.otpResendAfterMs - (Date.now() - last.createdAt.getTime());
    throw fail(429, 'OTP_TOO_SOON', `You can request another code in ${Math.ceil(waitMs / 1000)}s.`, { retryAfterMs: waitMs });
  }

  if (last && !last.consumedAt) {
    last.consumedAt = new Date();
    await last.save();
  }

  const code = randomCode();
  await dispatch(phone, code, purpose);
  const doc = await OtpCode.create({
    phone,
    purpose,
    codeHash: bcrypt.hashSync(code, 8),
    expiresAt: new Date(Date.now() + env.otpTtlMs)
  });

  // A code that never left the machine is not a secret yet, and without a gateway the app
  // cannot be driven otherwise, so development hands it back. Never in production.
  const echo = env.nodeEnv !== 'production' && env.smsProvider === 'log' ? code : undefined;
  return { expiresAt: doc.expiresAt, ttlMs: env.otpTtlMs, devCode: echo };
}

/**
 * Checks a code against the newest one for this phone and purpose. Every wrong guess is
 * counted against the cap, and a correct code is consumed in the same call, so a code cannot
 * be replayed even once.
 */
async function consume({ phone, purpose, code }) {
  const doc = await OtpCode.findOne({ phone, purpose, consumedAt: null }).sort({ createdAt: -1 });
  if (!doc) throw fail(400, 'OTP_MISSING', 'Request a code first.');
  if (!doc.isLive()) {
    doc.consumedAt = new Date();
    await doc.save();
    throw fail(400, 'OTP_EXPIRED', 'That code has expired. Request a new one.');
  }
  if (doc.attempts >= env.otpMaxAttempts) throw fail(429, 'OTP_ATTEMPTS', 'Too many wrong tries. Request a new code.');

  if (!bcrypt.compareSync(String(code || ''), doc.codeHash)) {
    doc.attempts += 1;
    await doc.save();
    const left = env.otpMaxAttempts - doc.attempts;
    // The guess that exhausts the cap is answered exactly like the next call to the same dead
    // code, so a client never sees one error under two statuses.
    throw fail(
      left > 0 ? 400 : 429,
      left > 0 ? 'OTP_BAD' : 'OTP_ATTEMPTS',
      left > 0 ? `Wrong code. ${left} try${left === 1 ? '' : 'ies'} left.` : 'Too many wrong tries. Request a new code.'
    );
  }

  doc.consumedAt = new Date();
  await doc.save();
}

module.exports = { send, consume };
