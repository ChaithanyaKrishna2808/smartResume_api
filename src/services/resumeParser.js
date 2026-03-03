const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const logger = require('../utils/logger');

/**
 * Extract plain text from uploaded resume file (PDF or DOCX)
 */
async function extractTextFromFile(fileBuffer, mimeType) {
  try {
    if (mimeType === 'application/pdf') {
      const data = await pdfParse(fileBuffer);
      return data.text.trim();
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value.trim();
    }

    if (mimeType === 'text/plain') {
      return fileBuffer.toString('utf-8').trim();
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
  } catch (error) {
    logger.error('Error extracting text from file', { error: error.message, mimeType });
    throw new Error(`Failed to parse resume: ${error.message}`);
  }
}

module.exports = { extractTextFromFile };
