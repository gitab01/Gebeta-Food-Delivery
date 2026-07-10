const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');
const Order = require('../models/Order');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // Authentication middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} | User: ${socket.user.id}`);

    // Join user-specific room
    socket.join(`user:${socket.user.id}`);

    // ─── DRIVER EVENTS ───────────────────────────────────────────────────────

    /**
     * Driver updates their GPS location
     * Payload: { lat, lng, orderId }
     */
    socket.on('driver:location', async ({ lat, lng, orderId }) => {
      try {
        // Update driver location in DB
        await Driver.findOneAndUpdate(
          { user: socket.user.id },
          {
            currentLocation: {
              type: 'Point',
              coordinates: [lng, lat],
            },
          }
        );

        // If driver has an active order, push location to customer
        if (orderId) {
          const order = await Order.findById(orderId).select('customer');
          if (order) {
            io.to(`user:${order.customer.toString()}`).emit('order:location_update', {
              orderId,
              location: { lat, lng },
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('driver:location error:', err.message);
      }
    });

    /**
     * Driver marks themselves available/unavailable
     */
    socket.on('driver:availability', async ({ isAvailable }) => {
      try {
        await Driver.findOneAndUpdate(
          { user: socket.user.id },
          { isAvailable, isOnline: true }
        );
        socket.emit('driver:availability_updated', { isAvailable });
        console.log(`Driver ${socket.user.id} availability: ${isAvailable}`);
      } catch (err) {
        console.error('driver:availability error:', err.message);
      }
    });

    /**
     * Driver accepts an order
     */
    socket.on('order:accept', async ({ orderId }) => {
      try {
        const order = await Order.findByIdAndUpdate(
          orderId,
          { driver: socket.user.id, status: 'picked_up' },
          { new: true }
        ).populate('customer', 'name fcmToken');

        if (order) {
          // Notify customer
          io.to(`user:${order.customer._id.toString()}`).emit('order:status_change', {
            orderId,
            status: 'picked_up',
            message: 'A driver has accepted your order!',
          });

          socket.emit('order:accept_confirmed', { orderId, order });
        }
      } catch (err) {
        console.error('order:accept error:', err.message);
      }
    });

    // ─── ORDER TRACKING ──────────────────────────────────────────────────────

    /**
     * Customer subscribes to order tracking
     */
    socket.on('order:track', ({ orderId }) => {
      socket.join(`order:${orderId}`);
      console.log(`User ${socket.user.id} tracking order ${orderId}`);
    });

    socket.on('order:untrack', ({ orderId }) => {
      socket.leave(`order:${orderId}`);
    });

    // ─── DISCONNECT ──────────────────────────────────────────────────────────

    socket.on('disconnect', async (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} | Reason: ${reason}`);
      if (socket.user.role === 'driver') {
        await Driver.findOneAndUpdate(
          { user: socket.user.id },
          { isOnline: false, isAvailable: false }
        ).catch(console.error);
      }
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
};

/**
 * Emit an event to a specific user room from outside socket context
 */
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Emit an event to all connected drivers
 */
const emitToDrivers = (event, data) => {
  if (io) {
    io.emit(event, data); // Or target a specific room
  }
};

/**
 * Broadcast order status change to relevant parties
 */
const broadcastOrderStatus = (order, status, message) => {
  if (!io) return;
  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status,
    message,
    timestamp: new Date().toISOString(),
  };
  // Notify customer
  io.to(`user:${order.customer.toString()}`).emit('order:status_change', payload);
  // Notify driver if assigned
  if (order.driver) {
    io.to(`user:${order.driver.toString()}`).emit('order:status_change', payload);
  }
  // Notify order tracking room
  io.to(`order:${order._id.toString()}`).emit('order:status_change', payload);
};

module.exports = { initSocket, emitToUser, emitToDrivers, broadcastOrderStatus };
