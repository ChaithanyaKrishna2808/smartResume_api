const aiService = require('../services/aiService');
const cache = require('../services/cacheService');
const logger = require('../utils/logger');

async function parseJD(req, res, next) {
  try {
    const { jobDescription } = req.body;
    const cacheKey = cache.buildKey('jd-parse', jobDescription);

    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug('JD parse cache hit');
      return res.json({ success: true, data: cached, cached: true });
    }

    const parsed = await aiService.parseJobDescription(jobDescription);
    await cache.set(cacheKey, parsed, 3600);

    res.json({ success: true, data: parsed, cached: false });
  } catch (err) {
    logger.error('parseJD error', { error: err.message });
    next(err);
  }
}

module.exports = { parseJD };
