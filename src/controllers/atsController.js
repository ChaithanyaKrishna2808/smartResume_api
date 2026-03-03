const aiService = require('../services/aiService');
const cache = require('../services/cacheService');
const logger = require('../utils/logger');

async function scoreATS(req, res, next) {
  try {
    const { jobDescription, resumeText } = req.body;
    const cacheKey = cache.buildKey('ats-score', jobDescription, resumeText);

    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug('ATS score cache hit');
      return res.json({ success: true, data: cached, cached: true });
    }

    const score = await aiService.calculateATSScore(jobDescription, resumeText);
    await cache.set(cacheKey, score, 1800);

    res.json({ success: true, data: score, cached: false });
  } catch (err) {
    logger.error('scoreATS error', { error: err.message });
    next(err);
  }
}

async function improveResume(req, res, next) {
  try {
    const { resumeText, jobDescription, atsScore } = req.body;

    if (!resumeText || !jobDescription || !atsScore) {
      return res.status(400).json({
        success: false,
        error: 'resumeText, jobDescription, and atsScore are required'
      });
    }

    const improvements = await aiService.improveResume(resumeText, jobDescription, atsScore);
    res.json({ success: true, data: improvements });
  } catch (err) {
    logger.error('improveResume error', { error: err.message });
    next(err);
  }
}

module.exports = { scoreATS, improveResume };
