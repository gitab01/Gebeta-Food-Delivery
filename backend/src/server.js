const http = require('http');
const env = require('./config/env');
const { connectDb, disconnectDb } = require('./config/db');
const { createApp } = require('./app');
const { initRealtime } = require('./realtime/io');
const { startWatchdog, stopWatchdog } = require('./services/watchdog');
const assignment = require('./services/assignment');

async function main() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);
  startWatchdog();

  server.listen(env.port, () => {
    console.log(`[gebeta] api + realtime listening on http://localhost:${env.port}`);
    console.log(`[gebeta] mongo ${env.mongoUri}`);
    console.log(`[gebeta] payment gateway: ${env.gateway}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[gebeta] ${signal} — closing`);
    stopWatchdog();
    assignment.stopAllTimers();
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[gebeta] failed to start:', err.message);
  process.exit(1);
});
