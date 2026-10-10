const express = require('express');
const Order = require('../models/Order');
const Rating = require('../models/Rating');
const Restaurant = require('../models/Restaurant');
const Courier = require('../models/Courier');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { createOrder, transition, getOrderForRequester } = require('../services/orderService');
const { orderPublicView } = require('../services/serialize');
const { STATUS, ACTOR } = require('../services/status');

const router = express.Router();
router.use(requireAuth, requireRole('customer'));

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { restaurantId, lines, addressId, deliveryAddress, contactPhone, notes } = req.body || {};
    if (!restaurantId || !Array.isArray(lines)) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'restaurantId and lines[] are required' } });
    }
    const order = await createOrder({
      customer: req.user,
      restaurantId,
      lines,
      addressId,
      deliveryAddress,
      contactPhone,
      notes
    });
    res.status(201).json({ order: orderPublicView(await order.populate('restaurantId')), paymentRequired: true });
  })
);

const scopeFilters = {
  active: { status: { $in: [STATUS.PLACED, STATUS.PAID, STATUS.PREPARING, STATUS.READY, STATUS.ASSIGNED, STATUS.PICKED_UP] } },
  done: { status: { $in: [STATUS.DELIVERED, STATUS.COMPLETED] } },
  closed: { status: { $in: [STATUS.REJECTED, STATUS.CANCELLED] } }
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { customerId: req.user._id, ...(scopeFilters[req.query.scope] || {}) };
    if (req.query.scope === 'all') delete filter.status;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 25).populate('restaurantId');
    res.json({ orders: orders.map(orderPublicView) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ order: await getOrderForRequester(req.params.id, req.user) });
  })
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    if (String(order.customerId) !== String(req.user._id)) {
      return res.status(403).json({ error: { code: 'NOT_OWNER', message: 'Not your order' } });
    }
    const { order: updated, changed } = await transition(order._id, {
      to: STATUS.CANCELLED,
      actor: ACTOR.CUSTOMER,
      actorId: req.user._id,
      note: req.body?.reason || 'Cancelled by customer'
    });
    if (!changed) return res.status(409).json({ error: { code: 'ALREADY_CLOSED', message: `Order is already ${order.status}` } });
    res.json({ order: orderPublicView(await updated.populate('restaurantId')) });
  })
);

/** One order, two targets: the kitchen and the courier who brought it. */
router.post(
  '/:id/rate',
  asyncHandler(async (req, res) => {
    const { restaurantStars, courierStars, restaurantComment = '', courierComment = '' } = req.body || {};
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    if (String(order.customerId) !== String(req.user._id)) {
      return res.status(403).json({ error: { code: 'NOT_OWNER', message: 'Not your order' } });
    }
    if (![STATUS.DELIVERED, STATUS.COMPLETED].includes(order.status)) {
      return res.status(409).json({ error: { code: 'NOT_DELIVERED', message: 'Rate an order once it has been delivered' } });
    }

    const targets = [
      { type: 'restaurant', id: order.restaurantId, stars: restaurantStars, comment: restaurantComment, flag: 'restaurant' },
      order.courierId ? { type: 'courier', id: order.courierId, stars: courierStars, comment: courierComment, flag: 'courier' } : null
    ].filter(Boolean);

    for (const target of targets) {
      if (target.stars == null) continue;
      const stars = Math.max(1, Math.min(5, Math.round(Number(target.stars))));
      await Rating.updateOne(
        { orderId: order._id, targetType: target.type },
        { $set: { customerId: req.user._id, targetId: target.id, stars, comment: target.comment } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      order.rated[target.flag] = true;
      if (target.type === 'restaurant') order.customerRatingStars = stars;
      else order.courierRatingStars = stars;
    }

    const restaurant = await Restaurant.findById(order.restaurantId);
    if (restaurantStars != null && restaurant) {
      const agg = await Rating.aggregate([
        { $match: { targetType: 'restaurant', targetId: restaurant._id } },
        { $group: { _id: null, avg: { $avg: '$stars' }, n: { $sum: 1 } } }
      ]);
      if (agg[0]) {
        restaurant.ratingStars = Math.round(agg[0].avg * 10) / 10;
        restaurant.ratingCount = agg[0].n;
        await restaurant.save();
      }
    }
    if (courierStars != null && order.courierId) {
      const courier = await Courier.findById(order.courierId);
      const agg = await Rating.aggregate([
        { $match: { targetType: 'courier', targetId: courier._id } },
        { $group: { _id: null, avg: { $avg: '$stars' }, n: { $sum: 1 } } }
      ]);
      if (courier && agg[0]) {
        courier.ratingStars = Math.round(agg[0].avg * 10) / 10;
        courier.ratingCount = agg[0].n;
        await courier.save();
      }
    }

    const needsRating = targets.length === 0 || targets.every((t) => t.stars == null);
    if (needsRating) return res.status(400).json({ error: { code: 'NO_RATINGS', message: 'Provide restaurantStars and/or courierStars' } });

    const { order: completed } = await transition(order._id, {
      to: STATUS.COMPLETED,
      actor: ACTOR.CUSTOMER,
      actorId: req.user._id,
      note: 'Customer rated the order'
    });
    res.json({ order: orderPublicView(await completed.populate('restaurantId')) });
  })
);

module.exports = router;
