const aiService = require('../services/aiService');
const { generateResumePDF } = require('../services/pdfGenerator');
const { extractTextFromFile } = require('../services/resumeParser');
const cache = require('../services/cacheService');
const logger = require('../utils/logger');

async function generateResume(req, res, next) {
  try {
    const { jobDescription, candidateInfo } = req.body;
    const cacheKey = cache.buildKey('resume-gen', jobDescription, JSON.stringify(candidateInfo));

    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug('Resume gen cache hit');
      return res.json({ success: true, data: cached, cached: true });
    }

    const resume = await aiService.generateResume(jobDescription, candidateInfo);
    await cache.set(cacheKey, resume, 1800);

    res.json({ success: true, data: resume, cached: false });
  } catch (err) {
    logger.error('generateResume error', { error: err.message });
    next(err);
  }
}

async function exportPDF(req, res, next) {
  try {
    const { resumeData } = req.body;
    if (!resumeData || !resumeData.name) {
      return res.status(400).json({ success: false, error: 'Invalid resume data' });
    }

    const pdf = await generateResumePDF(resumeData);

    const safeName = (resumeData.name || 'resume').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_resume.pdf"`);
    res.send(pdf);
  } catch (err) {
    logger.error('exportPDF error', { error: err.message });
    next(err);
  }
}

async function parseUploadedResume(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const text = await extractTextFromFile(req.file.buffer, req.file.mimetype);
    res.json({ success: true, data: { text, filename: req.file.originalname } });
  } catch (err) {
    logger.error('parseUploadedResume error', { error: err.message });
    next(err);
  }
}

module.exports = { generateResume, exportPDF, parseUploadedResume };
