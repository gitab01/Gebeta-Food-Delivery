const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// POST /api/drivers/register - Register as a driver
router.post('/register', async (req, res, next) => {
  try {
    const existing = await Driver.findOne({ user: req.user.id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Already registered as a driver' });
    }

    const driver = await Driver.create({ user: req.user.id, ...req.body });
    res.status(201).json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
});

// GET /api/drivers/profile
router.get('/profile', authorize('driver'), async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ user: req.user.id }).populate('user', 'name email phone avatar');
    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found' });
    res.json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/drivers/status - Toggle online/available
router.patch('/status', authorize('driver'), async (req, res, next) => {
  try {
    const { isOnline, isAvailable } = req.body;
    const driver = await Driver.findOneAndUpdate(
      { user: req.user.id },
      { isOnline, isAvailable },
      { new: true }
    );
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    res.json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
});

// GET /api/drivers/nearby?lat=X&lng=Y&radius=5000
router.get('/nearby', async (req, res, next) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }

    const drivers = await Driver.find({
      isOnline: true,
      isAvailable: true,
      currentLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(radius),
        },
      },
    }).populate('user', 'name avatar phone');

    res.json({ success: true, data: drivers });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
