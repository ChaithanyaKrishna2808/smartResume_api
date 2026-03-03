const logger = require('../utils/logger');

// In-memory cache fallback when Redis is not available
const memoryCache = new Map();

let redisClient = null;
let useMemoryCache = false;

async function initCache() {
  if (!process.env.REDIS_URL) {
    logger.info('No REDIS_URL set, using in-memory cache');
    useMemoryCache = true;
    return;
  }

  try {
    const { createClient } = require('redis');
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => {
      logger.warn('Redis error, falling back to memory cache', { error: err.message });
      useMemoryCache = true;
    });
    await redisClient.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn('Redis unavailable, using in-memory cache', { error: err.message });
    useMemoryCache = true;
  }
}

async function get(key) {
  try {
    if (useMemoryCache || !redisClient) {
      const entry = memoryCache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiry) {
        memoryCache.delete(key);
        return null;
      }
      return entry.value;
    }
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    logger.warn('Cache get error', { error: err.message });
    return null;
  }
}

async function set(key, value, ttlSeconds = 3600) {
  try {
    if (useMemoryCache || !redisClient) {
      memoryCache.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
      return;
    }
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn('Cache set error', { error: err.message });
  }
}

function buildKey(...parts) {
  const crypto = require('crypto');
  const raw = parts.join('|');
  return crypto.createHash('md5').update(raw).digest('hex');
}

module.exports = { initCache, get, set, buildKey };
