const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, name: user.name }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Loads req.user from the bearer token. Rejects blocked accounts. */
async function requireAuth(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      const err = new Error('Authentication required');
      err.status = 401;
      throw err;
    }
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (!user || user.isBlocked) {
      const err = new Error('Account unavailable');
      err.status = 401;
      throw err;
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (!err.status) err.status = 401;
    err.message = err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' ? 'Session expired' : err.message;
    next(err);
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      const err = new Error('Authentication required');
      err.status = 401;
      return next(err);
    }
    if (!roles.includes(req.user.role)) {
      const err = new Error(`Requires role: ${roles.join(' or ')}`);
      err.status = 403;
      return next(err);
    }
    next();
  };
}

module.exports = { signToken, verifyToken, extractToken, requireAuth, requireRole };
