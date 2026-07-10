const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const { broadcastOrderStatus, emitToDrivers } = require('../socket');

// @desc    Place a new order
// @route   POST /api/orders
exports.createOrder = async (req, res, next) => {
  try {
    const { restaurantId, items, deliveryAddress, paymentMethod } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant || !restaurant.isActive) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    if (!restaurant.isOpen) {
      return res.status(400).json({ success: false, message: 'Restaurant is currently closed' });
    }

    // Build order items with prices from DB
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const menuItem = await MenuItem.findOne({ _id: item.menuItemId, restaurant: restaurantId, isAvailable: true });
      if (!menuItem) {
        return res.status(400).json({ success: false, message: `Menu item not available: ${item.menuItemId}` });
      }

      let itemPrice = menuItem.price;

      // Apply customization prices
      const customizations = [];
      if (item.customizations) {
        for (const custom of item.customizations) {
          customizations.push({
            name: custom.name,
            selectedOption: custom.selectedOption,
            additionalPrice: custom.additionalPrice || 0,
          });
          itemPrice += custom.additionalPrice || 0;
        }
      }

      const itemSubtotal = itemPrice * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        customizations,
        subtotal: itemSubtotal,
      });
    }

    const deliveryFee = restaurant.deliveryFee || 0;
    const serviceFee = parseFloat((subtotal * 0.05).toFixed(2)); // 5% service fee
    const tax = parseFloat((subtotal * 0.15).toFixed(2));        // 15% tax
    const total = subtotal + deliveryFee + serviceFee + tax;

    if (subtotal < restaurant.minimumOrder) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is ${restaurant.minimumOrder} ETB`,
      });
    }

    const order = await Order.create({
      customer: req.user.id,
      restaurant: restaurantId,
      items: orderItems,
      deliveryAddress,
      payment: {
        method: paymentMethod || 'card',
        status: 'pending',
        amount: total,
      },
      pricing: {
        subtotal,
        deliveryFee,
        serviceFee,
        tax,
        total,
      },
      statusHistory: [{ status: 'pending', note: 'Order placed by customer' }],
    });

    const populatedOrder = await order.populate([
      { path: 'restaurant', select: 'name logo address phone' },
      { path: 'items.menuItem', select: 'name image' },
    ]);

    // Notify available drivers about new order
    emitToDrivers('order:new', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      restaurant: { name: restaurant.name, address: restaurant.address },
      deliveryAddress,
      pricing: order.pricing,
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: populatedOrder,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get orders for current user
// @route   GET /api/orders
exports.getMyOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = req.user.role === 'driver'
      ? { driver: req.user.id }
      : { customer: req.user.id };

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('restaurant', 'name logo')
        .populate('driver', 'name avatar'),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name phone avatar')
      .populate('driver', 'name phone avatar')
      .populate('restaurant', 'name logo address phone')
      .populate('items.menuItem', 'name image');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Authorization: only customer, assigned driver, or admin
    const isOwner = order.customer._id.toString() === req.user.id;
    const isDriver = order.driver && order.driver._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isDriver && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready'],
      ready: ['picked_up'],
      picked_up: ['on_the_way'],
      on_the_way: ['delivered'],
    };

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${order.status}' to '${status}'`,
      });
    }

    order.status = status;
    order.statusHistory.push({ status, note: note || '' });

    if (status === 'delivered') {
      order.actualDeliveryTime = new Date();
    }

    await order.save();

    const messages = {
      confirmed: 'Your order has been confirmed by the restaurant!',
      preparing: 'The restaurant is preparing your food.',
      ready: 'Your order is ready for pickup!',
      picked_up: 'A driver has picked up your order.',
      on_the_way: 'Your order is on the way!',
      delivered: 'Your order has been delivered. Enjoy!',
      cancelled: 'Your order has been cancelled.',
    };

    broadcastOrderStatus(order, status, messages[status] || `Order status updated to ${status}`);

    res.json({ success: true, message: 'Order status updated', data: order });
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel an order
// @route   POST /api/orders/:id/cancel
exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const cancellableStatuses = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage',
      });
    }

    if (order.customer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    order.status = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by customer';
    order.statusHistory.push({ status: 'cancelled', note: reason });
    await order.save();

    broadcastOrderStatus(order, 'cancelled', 'Order has been cancelled.');

    res.json({ success: true, message: 'Order cancelled successfully', data: order });
  } catch (err) {
    next(err);
  }
};

// @desc    Rate an order
// @route   POST /api/orders/:id/rate
exports.rateOrder = async (req, res, next) => {
  try {
    const { food, delivery, review } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Can only rate delivered orders' });
    }

    order.rating = { food, delivery, review };
    await order.save();

    res.json({ success: true, message: 'Thank you for your rating!', data: order.rating });
  } catch (err) {
    next(err);
  }
};
