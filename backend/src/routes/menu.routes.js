const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');
const { protect, authorize } = require('../middleware/auth');

// GET /api/menus?restaurantId=xxx
router.get('/', async (req, res, next) => {
  try {
    const { restaurantId } = req.query;
    const query = restaurantId ? { restaurant: restaurantId, isAvailable: true } : { isAvailable: true };
    const items = await MenuItem.find(query).sort({ category: 1, name: 1 });
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/menus - Create menu item (admin only)
router.post('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const item = await MenuItem.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// PUT /api/menus/:id - Update menu item
router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/menus/:id
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: 'Menu item deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
