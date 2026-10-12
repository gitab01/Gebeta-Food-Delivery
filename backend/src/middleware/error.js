/** Wraps async route handlers so rejections reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, _res, next) {
  const err = new Error(`No route for ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

function errorHandler(err, _req, res, _next) {
  const status = err.status || (err.name === 'IllegalTransition' ? 409 : 500);
  const body = {
    error: {
      code: err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
      message: status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    }
  };
  if (err.from && err.to) body.error.detail = { from: err.from, to: err.to };
  if (status >= 500) console.error('[api]', err);
  res.status(status).json(body);
}

module.exports = { asyncHandler, notFound, errorHandler };
