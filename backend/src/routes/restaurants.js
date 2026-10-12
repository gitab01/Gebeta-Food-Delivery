const express = require('express');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const { asyncHandler } = require('../middleware/error');
const { restaurantPublicView } = require('../services/serialize');
const { distanceMeters } = require('../services/geo');

const router = express.Router();

/** Discovery list. Distance and ETA are computed against the caller's position when supplied. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
    const filter = {};
    if (req.query.open === 'true') filter.isOpen = true;
    if (req.query.cuisine) filter.cuisine = req.query.cuisine;

    const restaurants = await Restaurant.find(filter).sort({ ratingStars: -1, name: 1 });
    let views = restaurants.map(restaurantPublicView);

    if (hasGeo) {
      views = views
        .map((v) => {
          const metres = distanceMeters({ lat, lng }, { lat: v.lat, lng: v.lng });
          return { ...v, distanceMeters: metres, withinRange: metres != null && metres <= v.deliveryRadiusMeters };
        })
        .filter((v) => (req.query.withinRange === 'true' ? v.withinRange : true))
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    }

    if (req.query.q) {
      const needle = String(req.query.q).toLowerCase();
      views = views.filter(
        (v) => v.name.toLowerCase().includes(needle) || v.cuisine.some((c) => c.toLowerCase().includes(needle))
      );
    }
    res.json({ restaurants: views, count: views.length });
  })
);

/** Public "what's cooking near me right now" strip used by the admin and app home screens. */
router.get(
  '/meta/live',
  asyncHandler(async (_req, res) => {
    const orders = await Order.find({ status: { $in: ['PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP'] } })
      .select('restaurantId status eta')
      .populate('restaurantId', 'name')
      .limit(50)
      .lean();
    res.json({
      live: orders.map((o) => ({
        restaurantId: String(o.restaurantId?._id || ''),
        restaurantName: o.restaurantId?.name || null,
        status: o.status,
        etaMinutes: o.eta?.minutes ?? null
      }))
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } });
    const view = restaurantPublicView(restaurant);
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      view.distanceMeters = distanceMeters({ lat, lng }, { lat: view.lat, lng: view.lng });
      view.withinRange = view.distanceMeters <= view.deliveryRadiusMeters;
    }
    res.json({ restaurant: view });
  })
);

module.exports = router;
