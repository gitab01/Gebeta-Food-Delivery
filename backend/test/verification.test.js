require('./localDatabase');

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.SMS_PROVIDER = 'log';
process.env.OTP_RESEND_AFTER_MS = '0';
process.env.OTP_TTL_MS = '60000';
process.env.OTP_MAX_ATTEMPTS = '3';
process.env.OTP_HOURLY_CAP = '4';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { connectDb, disconnectDb, mongoose } = require('../src/config/db');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Courier = require('../src/models/Courier');
const CourierDocument = require('../src/models/CourierDocument');
const OtpCode = require('../src/models/OtpCode');
const env = require('../src/config/env');

let baseUrl;
let server;

const call = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
};

// A JPEG header would be nice, but the server only ever counts and stores these bytes.
const photo = (seed) => `data:image/jpeg;base64,${Buffer.from(`gebeta-document-photo-${seed}`).toString('base64')}`;

/** Reads the code back out of the database the way a phone would have received it. */
const latestCode = async (phone, purpose) => {
  const doc = await OtpCode.findOne({ phone, purpose }).sort({ createdAt: -1 });
  return doc;
};

test.before(async () => {
  await connectDb();
  await Promise.all([
    User.deleteMany({}),
    Courier.deleteMany({}),
    CourierDocument.deleteMany({}),
    OtpCode.deleteMany({}),
    mongoose.connection.db.collection('orders').deleteMany({}),
    mongoose.connection.db.collection('payments').deleteMany({})
  ]);
  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDb();
});

/**
 * A customer is trusted with a saved address and a payment brand, so the account is only
 * opened once a code that went to that number is handed back.
 */
test('a customer cannot be created without the code that was sent to their phone', async () => {
  const phone = '0911000101';
  const signup = { phone, name: 'Self Service', password: 'gebeta123', role: 'customer' };

  const blind = await call('/api/auth/register', { method: 'POST', body: signup });
  assert.equal(blind.status, 400);
  assert.equal(blind.body.error.code, 'OTP_MISSING', 'no code, no account');
  assert.equal(await User.countDocuments({ phone }), 0);

  const sent = await call('/api/auth/otp/send', { method: 'POST', body: { phone, purpose: 'register' } });
  assert.equal(sent.status, 201);
  assert.ok(sent.body.expiresAt, 'the app is told how long the code is good for');

  const wrong = await call('/api/auth/register', { method: 'POST', body: { ...signup, code: '000000' } });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error.code, 'OTP_BAD');

  const doc = await latestCode(phone, 'register');
  assert.equal(doc.attempts, 1, 'a wrong guess is counted, not just refused');
  assert.ok(!doc.codeHash.includes('000000'), 'the code is stored hashed');

  const right = await call('/api/auth/register', { method: 'POST', body: { ...signup, code: sent.body.devCode } });
  assert.equal(right.status, 201, JSON.stringify(right.body));
  assert.ok(right.body.token);
  assert.ok(right.body.user.id);

  // The same code cannot be spent twice, even by the person it was sent to.
  const replay = await call('/api/auth/register', { method: 'POST', body: { ...signup, code: sent.body.devCode } });
  assert.equal(replay.status, 409, 'the number is taken now, and the code is gone either way');
  assert.equal((await User.findOne({ phone })).phoneVerifiedAt instanceof Date, true, 'the account is stamped as phone-verified');
});

test('a code that has been guessed at too often is dead even to the person holding it', async () => {
  const phone = '0911000102';
  const sent = await call('/api/auth/otp/send', { method: 'POST', body: { phone, purpose: 'register' } });
  const signup = (code) => ({ phone, name: 'Guesser', password: 'gebeta123', role: 'customer', code });

  for (let i = 0; i < env.otpMaxAttempts; i += 1) {
    const bad = await call('/api/auth/register', { method: 'POST', body: signup('000000') });
    assert.equal(bad.status, i < env.otpMaxAttempts - 1 ? 400 : 429, `try ${i + 1}: ${JSON.stringify(bad.body)}`);
  }

  // The cap is on the code, not on the customer: the right answer no longer counts either.
  const rightButDead = await call('/api/auth/register', { method: 'POST', body: signup(sent.body.devCode) });
  assert.equal(rightButDead.status, 429);
  assert.equal(rightButDead.body.error.code, 'OTP_ATTEMPTS');

  const fresh = await call('/api/auth/otp/send', { method: 'POST', body: { phone, purpose: 'register' } });
  assert.equal(fresh.status, 201);
  const recovered = await call('/api/auth/register', { method: 'POST', body: signup(fresh.body.devCode) });
  assert.equal(recovered.status, 201, 'a new code puts an honest customer back on the path');
});

test('an expired code says so instead of pretending to be a wrong answer', async () => {
  const phone = '0911000105';
  const sent = await call('/api/auth/otp/send', { method: 'POST', body: { phone, purpose: 'register' } });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  const doc = await latestCode(phone, 'register');
  doc.expiresAt = new Date(Date.now() - 1000);
  await doc.save();

  const late = await call('/api/auth/register', {
    method: 'POST',
    body: { phone, name: 'Late', password: 'gebeta123', role: 'customer', code: '111111' }
  });
  assert.equal(late.status, 400);
  assert.equal(late.body.error.code, 'OTP_EXPIRED');
});

test('codes cannot be requested without limit', async () => {
  const phone = '0911000103';
  let last;
  for (let i = 0; i < env.otpHourlyCap; i += 1) {
    last = await call('/api/auth/otp/send', { method: 'POST', body: { phone, purpose: 'register' } });
    assert.equal(last.status, 201, `send ${i + 1} of ${env.otpHourlyCap} is allowed`);
  }
  const capped = await call('/api/auth/otp/send', { method: 'POST', body: { phone, purpose: 'register' } });
  assert.equal(capped.status, 429);
  assert.equal(capped.body.error.code, 'OTP_LIMIT');
});

test('a forgotten password is replaced with the code sent to the number on the account', async () => {
  const phone = '0911000104';
  const sent = await call('/api/auth/otp/send', { method: 'POST', body: { phone, purpose: 'register' } });
  await call('/api/auth/register', { method: 'POST', body: { phone, name: 'Forgetful', password: 'gebeta123', code: sent.body.devCode } });

  const reset = await call('/api/auth/otp/send', { method: 'POST', body: { phone, purpose: 'reset' } });
  assert.equal(reset.status, 201);

  const bad = await call('/api/auth/reset-password', { method: 'POST', body: { phone, code: '999999', password: 'newpassword' } });
  assert.equal(bad.status, 400);

  const done = await call('/api/auth/reset-password', { method: 'POST', body: { phone, code: reset.body.devCode, password: 'newpassword' } });
  assert.equal(done.status, 200);
  assert.ok(done.body.token, 'the reset signs them in, so nothing is left half-finished');

  const old = await call('/api/auth/login', { method: 'POST', body: { phone, password: 'gebeta123' } });
  assert.equal(old.status, 401, 'the old password is dead');
  const fresh = await call('/api/auth/login', { method: 'POST', body: { phone, password: 'newpassword' } });
  assert.equal(fresh.status, 200);
});

test('a reset code only goes to a number that already has an account', async () => {
  const none = await call('/api/auth/otp/send', { method: 'POST', body: { phone: '0911999999', purpose: 'reset' } });
  assert.equal(none.status, 404);
  assert.equal(none.body.error.code, 'NO_ACCOUNT');
});

/**
 * The courier side: they may create the account, but being allowed to carry food and cash is
 * the operator's call, made against a photograph of an identity document.
 */
test('a courier signs up with papers and waits for the operator', async () => {
  const phone = '0911000201';
  const missing = await call('/api/auth/register', {
    method: 'POST',
    body: { phone, name: 'Papers Please', password: 'gebeta123', role: 'courier', vehicle: 'motorbike' }
  });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, 'DOCUMENT_REQUIRED');

  const same = await call('/api/auth/register', {
    method: 'POST',
    body: {
      phone,
      name: 'Papers Please',
      password: 'gebeta123',
      role: 'courier',
      document: { type: 'national_id', front: photo('a'), back: photo('a') }
    }
  });
  assert.equal(same.status, 400, 'one photo presented as both sides is not two sides');

  const badType = await call('/api/auth/register', {
    method: 'POST',
    body: {
      phone,
      name: 'Papers Please',
      password: 'gebeta123',
      role: 'courier',
      document: { type: 'library_card', front: photo('a'), back: photo('b') }
    }
  });
  assert.equal(badType.status, 400, 'only a real document type is accepted');

  const created = await call('/api/auth/register', {
    method: 'POST',
    body: {
      phone,
      name: 'Papers Please',
      password: 'gebeta123',
      role: 'courier',
      vehicle: 'motorbike',
      document: { type: 'driving_licence', front: photo('front'), back: photo('back') }
    }
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.courier.verification.status, 'pending');
  assert.equal(await CourierDocument.countDocuments({}), 1, 'the papers were filed');
  assert.equal(created.body.courier.verification.hasFront, true);

  const token = created.body.token;
  const online = await call('/api/courier/online', { method: 'POST', token, body: { isOnline: true } });
  assert.equal(online.status, 403, 'an unapproved courier cannot go looking for work');
  assert.equal(online.body.error.code, 'COURIER_NOT_VERIFIED');

  const offline = await call('/api/courier/online', { method: 'POST', token, body: { isOnline: false } });
  assert.equal(offline.status, 200, 'stopping is never refused');

  const mine = await call('/api/courier/verification', { token });
  assert.equal(mine.status, 200);
  assert.equal(mine.body.verification.status, 'pending');
  assert.equal(mine.body.verification.documentType, 'driving_licence');
  assert.equal(JSON.stringify(mine.body).includes('base64'), false, 'the courier is not handed their own photo bytes back');
});

test('an admin reads the papers, and only then is the courier allowed to work', async () => {
  const admin = new User({ phone: '0911000900', name: 'Operator', role: 'admin' });
  admin.setPassword('gebeta123');
  await admin.save();
  const { signToken } = require('../src/middleware/auth');
  const adminToken = signToken(admin);

  const courier = await Courier.findOne({}).sort({ createdAt: -1 });
  const userId = String(courier.userId);

  const queue = await call('/api/admin/couriers/verification?status=pending', { token: adminToken });
  assert.equal(queue.status, 200);
  assert.equal(queue.body.couriers.some((c) => c.userId === userId), true);
  assert.equal(JSON.stringify(queue.body).includes('gebeta-document-photo'), false, 'the queue carries no photo bytes');

  // Somebody else's account gets nothing, and a courier cannot read their own photo through admin.
  const customer = new User({ phone: '0911000901', name: 'Nosy', role: 'customer' });
  customer.setPassword('gebeta123');
  await customer.save();
  const { signToken: sign } = require('../src/middleware/auth');
  const peek = await call(`/api/admin/couriers/${userId}/verification/document/front`, { token: sign(customer) });
  assert.equal(peek.status, 403, 'the document route is admin-only');

  const front = await fetch(`${baseUrl}/api/admin/couriers/${userId}/verification/document/front`, {
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(front.status, 200);
  assert.equal(front.headers.get('content-type'), 'image/jpeg');
  assert.equal(front.headers.get('cache-control'), 'private, no-store');
  assert.equal(Buffer.from(await front.arrayBuffer()).toString(), 'gebeta-document-photo-front');

  const noReason = await call(`/api/admin/couriers/${userId}/verification`, {
    method: 'POST',
    token: adminToken,
    body: { decision: 'reject' }
  });
  assert.equal(noReason.status, 400, 'a rejection has to say why');

  const approved = await call(`/api/admin/couriers/${userId}/verification`, {
    method: 'POST',
    token: adminToken,
    body: { decision: 'approve', note: 'Licence readable, photo matches' }
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.courier.verification.status, 'approved');

  const courierToken = (await call('/api/auth/login', { method: 'POST', body: { phone: courier.phone, password: 'gebeta123' } })).body.token;
  const online = await call('/api/courier/online', { method: 'POST', token: courierToken, body: { isOnline: true } });
  assert.equal(online.status, 200, 'approval is what opens the job board');
});

test('a rejected courier can re-file and goes back into the queue', async () => {
  const { signToken } = require('../src/middleware/auth');
  const admin = await User.findOne({ role: 'admin' });
  const adminToken = signToken(admin);
  const courier = await Courier.findOne({}).sort({ createdAt: -1 });

  const rejected = await call(`/api/admin/couriers/${courier.userId}/verification`, {
    method: 'POST',
    token: adminToken,
    body: { decision: 'reject', note: 'The back photo is unreadable' }
  });
  assert.equal(rejected.status, 200);

  const courierToken = (await call('/api/auth/login', { method: 'POST', body: { phone: courier.phone, password: 'gebeta123' } })).body.token;
  const blocked = await call('/api/courier/online', { method: 'POST', token: courierToken, body: { isOnline: true } });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.message, 'The back photo is unreadable', 'the courier is told the reason, in their own app');

  const refilled = await call('/api/courier/documents', {
    method: 'POST',
    token: courierToken,
    body: { type: 'passport', front: photo('new-front'), back: photo('new-back') }
  });
  assert.equal(refilled.status, 201, JSON.stringify(refilled.body));
  assert.equal(refilled.body.verification.status, 'pending', 'a fresh submission restarts the review');
  assert.equal(refilled.body.verification.documentType, 'passport');

  const tooBig = await call('/api/courier/documents', {
    method: 'POST',
    token: courierToken,
    body: { type: 'passport', front: `data:image/jpeg;base64,${Buffer.alloc(env.courierDocMaxBytes + 1, 7).toString('base64')}`, back: photo('new-back') }
  });
  assert.equal(tooBig.status, 413, 'the photo cap is enforced after decoding, not just on the wire');
});
