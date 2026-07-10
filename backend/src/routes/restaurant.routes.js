const express = require('express');
const router = express.Router();
const {
  getRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  toggleRestaurant,
} = require('../controllers/restaurant.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getRestaurants);
router.get('/:id', getRestaurant);
router.post('/', protect, authorize('admin'), createRestaurant);
router.put('/:id', protect, authorize('admin'), updateRestaurant);
router.patch('/:id/toggle', protect, authorize('admin'), toggleRestaurant);

module.exports = router;
