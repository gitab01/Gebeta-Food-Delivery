/**
 * Pin every test file to a local database, before anything else reads the environment.
 *
 * The suites empty each collection they touch, so a shared database is not just the wrong
 * target — pointing them at one deletes real data. Anything that is not obviously a local
 * mongod stops the run here instead.
 */
const requested = process.env.TEST_MONGODB_URI || '';
if (requested && !/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(requested)) {
  throw new Error('TEST_MONGODB_URI must point at a local mongodb://127.0.0.1 database; the suites delete their collections');
}

process.env.MONGODB_URI = requested || 'mongodb://127.0.0.1:27017/gebeta_test';
