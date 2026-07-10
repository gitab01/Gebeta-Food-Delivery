const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  rateOrder,
} = require('../controllers/order.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getMyOrders)
  .post(authorize('customer'), createOrder);

router.route('/:id')
  .get(getOrder);

router.patch('/:id/status', authorize('admin', 'driver'), updateOrderStatus);
router.post('/:id/cancel', cancelOrder);
router.post('/:id/rate', authorize('customer'), rateOrder);

module.exports = router;
