const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');

// @desc    Get all restaurants (with optional search & filters)
// @route   GET /api/restaurants
exports.getRestaurants = async (req, res, next) => {
  try {
    const { search, cuisine, lat, lng, radius = 10000, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };

    if (search) {
      query.$text = { $search: search };
    }

    if (cuisine) {
      query.cuisine = { $in: cuisine.split(',') };
    }

    let dbQuery;

    // Geo-based query
    if (lat && lng) {
      dbQuery = Restaurant.find({
        ...query,
        'address.coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: parseInt(radius),
          },
        },
      });
    } else {
      dbQuery = Restaurant.find(query).sort({ 'rating.average': -1 });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [restaurants, total] = await Promise.all([
      dbQuery.skip(skip).limit(parseInt(limit)).select('-openingHours'),
      Restaurant.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: restaurants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single restaurant with menu
// @route   GET /api/restaurants/:id
exports.getRestaurant = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).populate('owner', 'name email');
    if (!restaurant || !restaurant.isActive) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const menu = await MenuItem.find({ restaurant: restaurant._id, isAvailable: true });

    // Group menu by category
    const menuByCategory = menu.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    res.json({
      success: true,
      data: { restaurant, menu: menuByCategory },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create restaurant
// @route   POST /api/restaurants
exports.createRestaurant = async (req, res, next) => {
  try {
    req.body.owner = req.user.id;
    const restaurant = await Restaurant.create(req.body);
    res.status(201).json({ success: true, data: restaurant });
  } catch (err) {
    next(err);
  }
};

// @desc    Update restaurant
// @route   PUT /api/restaurants/:id
exports.updateRestaurant = async (req, res, next) => {
  try {
    let restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    restaurant = await Restaurant.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: restaurant });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle restaurant open/closed
// @route   PATCH /api/restaurants/:id/toggle
exports.toggleRestaurant = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    restaurant.isOpen = !restaurant.isOpen;
    await restaurant.save();

    res.json({
      success: true,
      message: `Restaurant is now ${restaurant.isOpen ? 'open' : 'closed'}`,
      data: { isOpen: restaurant.isOpen },
    });
  } catch (err) {
    next(err);
  }
};
