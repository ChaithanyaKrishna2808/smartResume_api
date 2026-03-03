const express = require('express');
const multer = require('multer');
const { validate } = require('../middleware/validation');
const jdController = require('../controllers/jdController');
const resumeController = require('../controllers/resumeController');
const atsController = require('../controllers/atsController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed'));
    }
  }
});

// Health check
router.get('/health', (req, res) => res.json({ success: true, status: 'ok', timestamp: new Date() }));

// JD Routes
router.post('/jd/parse', validate('parseJD'), jdController.parseJD);

// Resume Routes
router.post('/resume/generate', validate('generateResume'), resumeController.generateResume);
router.post('/resume/export-pdf', validate('exportPDF'), resumeController.exportPDF);
router.post('/resume/parse-file', upload.single('resume'), resumeController.parseUploadedResume);

// ATS Routes
router.post('/ats/score', validate('atsScore'), atsController.scoreATS);
router.post('/ats/improve', atsController.improveResume);

module.exports = router;
