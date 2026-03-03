const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err.name === 'SyntaxError' && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body' });
  }

  if (err.message && err.message.includes('AI response')) {
    return res.status(502).json({ success: false, error: 'AI service error. Please try again.' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
}

function notFound(req, res) {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
}

module.exports = { errorHandler, notFound };
