const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const Settings = require('./models/Settings');
const { asyncHandler, notFound, errorHandler } = require('./middleware/error');
const payments = require('./routes/payments');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.corsOrigin.includes('*') ? true : env.corsOrigin, credentials: true }));

  // The gateway callback needs the untouched request body to verify its signature,
  // so it is mounted before any JSON parsing happens.
  app.use('/webhooks', payments.webhookRouter);

  // A courier's papers are two photos posted inline as base64, so these two paths need a much
  // wider body than anything else here. Everything else stays on the 512kb limit below.
  const photoJson = express.json({ limit: env.photoBodyLimit });
  app.use('/api/auth/register', photoJson);
  app.use('/api/courier/documents', photoJson);

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

  // What the apps need for their About and Contact rows before anyone signs in.
  app.get(
    '/api/meta',
    asyncHandler(async (_req, res) => {
      const settings = await Settings.load();
      res.json({
        supportContact: settings.supportContact || '',
        currency: settings.currency,
        language: settings.language,
        maintenanceMode: settings.maintenanceMode
      });
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
