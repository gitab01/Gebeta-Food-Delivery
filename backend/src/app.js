const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');
const payments = require('./routes/payments');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.corsOrigin.includes('*') ? true : env.corsOrigin, credentials: true }));

  // The gateway callback needs the untouched request body to verify its signature,
  // so it is mounted before any JSON parsing happens.
  app.use('/webhooks', payments.webhookRouter);

  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) =>
    res.json({
      ok: true,
      service: 'gebeta-api',
      gateway: env.gateway,
      realtime: 'socket.io',
      offerTimeoutMs: env.offerTimeoutMs,
      courierLoadCap: env.courierLoadCap,
      at: new Date().toISOString()
    })
  );

  app.use('/api/auth', require('./routes/auth').router);
  app.use('/api/restaurants', require('./routes/restaurants'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/payments', payments);
  app.use('/api/restaurant-owner', require('./routes/restaurantOwner'));
  app.use('/api/courier', require('./routes/courier'));
  app.use('/api/admin', require('./routes/admin'));

  app.get('/api', (_req, res) =>
    res.json({
      service: 'gebeta-api',
      endpoints: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET  /api/restaurants',
        'GET  /api/restaurants/:id',
        'POST /api/orders',
        'POST /api/payments/intent',
        'POST /api/payments/mock/confirm',
        'POST /api/restaurant-owner/orders/:id/accept',
        'POST /api/courier/jobs/:id/pickup',
        'GET  /api/admin/stats'
      ],
      realtime: 'Socket.IO on the same origin — handshake auth.token, rooms order:<id>, user:<id>, restaurant:<id>, couriers:pool, role:admin'
    })
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
