require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { initCache } = require('./services/cacheService');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet());
app.use(compression());

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:4200',
  // add other local dev origins if needed
  'http://localhost:64384'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (like curl, Postman)
    if (!origin) return callback(null, true);
    // allow configured origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // during development be permissive to avoid blocking local tools
    if ((process.env.NODE_ENV || 'development') !== 'production') return callback(null, true);
    logger.warn('Blocked CORS request from origin', { origin });
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.'
    });
  }
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// Routes
app.use('/api', routes);

// 404 & Error handlers
app.use(notFound);
app.use(errorHandler);

// Start server: initialize cache and verify required env vars before listening
async function start() {
  try {
    await initCache();

    // Require at least one AI provider API key. Prefer GOOGLE_API_KEY for Gemini.
    if (!process.env.GOOGLE_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      logger.error('Missing AI API key. Set GOOGLE_API_KEY (preferred) or ANTHROPIC_API_KEY', { env: Object.keys(process.env) });
      // Exit with non-zero code to indicate configuration error
      process.exit(1);
    }

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (err) {
    logger.error('Failed during startup', { error: err.message });
    process.exit(1);
  }
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});

module.exports = app;
