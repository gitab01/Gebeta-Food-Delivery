const express = require('express');
const User = require('../models/User');
const Courier = require('../models/Courier');
const { signToken, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

const publicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  phone: user.phone,
  email: user.email || '',
  role: user.role,
  addresses: (user.addresses || []).map((a) => ({
    id: String(a._id),
    label: a.label,
    line: a.line,
    city: a.city,
    lat: a.lat,
    lng: a.lng,
    contactPhone: a.contactPhone || user.phone
  })),
  paymentMethods: (user.paymentMethods || []).map((m) => ({
    id: String(m._id),
    brand: m.brand,
    label: m.label || '',
    last4: m.last4 || '',
    expiryMonth: m.expiryMonth ?? null,
    expiryYear: m.expiryYear ?? null,
    isDefault: Boolean(m.isDefault)
  }))
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { phone, name, password, role = 'customer', address } = req.body || {};
    if (!phone || !name || !password) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'phone, name and password are required' } });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'password must be at least 6 characters' } });
    }
    if (!['customer', 'courier'].includes(role)) {
      return res.status(403).json({ error: { code: 'ROLE_NOT_SELF_SERVICE', message: 'Restaurant and admin accounts are provisioned by the operator' } });
    }
    if (await User.findOne({ phone })) {
      return res.status(409).json({ error: { code: 'PHONE_TAKEN', message: 'That phone number already has an account' } });
    }

    const user = new User({ phone, name, role });
    user.setPassword(password);
    if (address?.line && Number.isFinite(Number(address.lat))) {
      user.addresses.push({
        label: address.label || 'Home',
        line: address.line,
        city: address.city || 'Addis Ababa',
        lat: Number(address.lat),
        lng: Number(address.lng),
        contactPhone: address.contactPhone || phone
      });
    }
    await user.save();

    if (role === 'courier') {
      await Courier.create({
        userId: user._id,
        name: user.name,
        phone: user.phone,
        vehicle: req.body.vehicle || 'motorbike'
      });
    }
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body || {};
    const user = await User.findOne({ phone });
    if (!user || !user.verifyPassword(password || '')) {
      return res.status(401).json({ error: { code: 'BAD_CREDENTIALS', message: 'Phone number or password is wrong' } });
    }
    if (user.isBlocked) return res.status(403).json({ error: { code: 'BLOCKED', message: 'This account is suspended' } });
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = { user: publicUser(req.user) };
    if (req.user.role === 'courier') payload.courier = await Courier.findOne({ userId: req.user._id }).lean();
    res.json(payload);
  })
);

router.post(
  '/me/addresses',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { label, line, city, lat, lng, contactPhone } = req.body || {};
    if (!line || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'line, lat and lng are required' } });
    }
    req.user.addresses.push({ label: label || 'Home', line, city: city || 'Addis Ababa', lat: Number(lat), lng: Number(lng), contactPhone: contactPhone || req.user.phone });
    await req.user.save();
    res.status(201).json({ user: publicUser(req.user) });
  })
);

router.delete(
  '/me/addresses/:addressId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const address = req.user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Address not found' } });
    address.deleteOne();
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  })
);

const BRANDS = ['card', 'telebirr', 'cbebir', 'cash'];

/**
 * These endpoints store a *choice*, never card data. A request that carries anything
 * resembling a PAN is refused outright - it is not saved, not echoed back, and not
 * passed on - because the gateway is the only component allowed to see one.
 */
router.post(
  '/me/payment-methods',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (body.number || body.cardNumber || body.pan || body.cvv) {
      return res.status(400).json({
        error: { code: 'CARD_DATA_NOT_ACCEPTED', message: 'Do not send a card number. Save the brand and the last four digits only.' }
      });
    }
    const { brand, label = '', last4 = '', expiryMonth, expiryYear } = body;
    if (!BRANDS.includes(brand)) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: `brand must be one of ${BRANDS.join(', ')}` } });
    }
    const digits = String(last4).trim();
    if (brand === 'card') {
      if (!/^\d{4}$/.test(digits)) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'A saved card stores exactly the last 4 digits' } });
      }
      const month = Number(expiryMonth);
      const year = Number(expiryYear);
      if (!(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100)) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'expiryMonth (1-12) and expiryYear are required for a card' } });
      }
    }
    if (req.user.paymentMethods.some((m) => m.brand === brand && (m.last4 || '') === digits && (m.label || '') === String(label).trim())) {
      return res.status(409).json({ error: { code: 'ALREADY_SAVED', message: 'That payment method is already saved' } });
    }

    const first = req.user.paymentMethods.length === 0;
    if (!first) req.user.paymentMethods.forEach((m) => { m.isDefault = false; });
    req.user.paymentMethods.push({
      brand,
      label: String(label).slice(0, 40),
      last4: brand === 'card' ? digits : '',
      expiryMonth: brand === 'card' ? Number(expiryMonth) : undefined,
      expiryYear: brand === 'card' ? Number(expiryYear) : undefined,
      isDefault: first
    });
    await req.user.save();
    res.status(201).json({ user: publicUser(req.user) });
  })
);

router.patch(
  '/me/payment-methods/:methodId/default',
  requireAuth,
  asyncHandler(async (req, res) => {
    const method = req.user.paymentMethods.id(req.params.methodId);
    if (!method) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payment method not found' } });
    req.user.paymentMethods.forEach((m) => { m.isDefault = String(m._id) === String(method._id); });
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  })
);

router.delete(
  '/me/payment-methods/:methodId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const method = req.user.paymentMethods.id(req.params.methodId);
    if (!method) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payment method not found' } });
    const wasDefault = method.isDefault;
    method.deleteOne();
    if (wasDefault && req.user.paymentMethods.length) req.user.paymentMethods[0].isDefault = true;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  })
);

module.exports = { router, publicUser };
