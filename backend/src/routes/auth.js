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

module.exports = { router, publicUser };
