const https = require('https');
const { URL } = require('url');
const logger = require('../utils/logger');

// Use Google Gemini models. Set your API key in the environment as GOOGLE_API_KEY.
// Both FAST and QUALITY point to the same model here; change as you see fit.
const MODELS = {
  FAST: 'gemini-flash-latest',
  QUALITY: 'gemini-flash-latest'
};

function extractGeneratedText(obj) {
  // Extract text from Gemini API response structure
  // Expected: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
  if (!obj || typeof obj !== 'object') return null;
  
  try {
    if (obj.candidates && Array.isArray(obj.candidates) && obj.candidates.length > 0) {
      const candidate = obj.candidates[0];
      if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
        for (const part of candidate.content.parts) {
          if (part.text && typeof part.text === 'string') {
            return part.text;
          }
        }
      }
    }
  } catch (e) {
    // fall through
  }
  
  // Fallback: deep search for any string value (prefer longer ones)
  let best = '';
  function dfs(node) {
    if (!node) return;
    if (typeof node === 'string') {
      if (node.length > best.length) best = node;
      return;
    }
    if (Array.isArray(node)) {
      for (const v of node) dfs(v);
      return;
    }
    if (typeof node === 'object') {
      for (const k of Object.keys(node)) dfs(node[k]);
    }
  }
  dfs(obj);
  return best || null;
}

function parseJSONorExtract(text) {
  if (!text || typeof text !== 'string') throw new Error('No text to parse');
  
  // Prefer explicit markers if present
  const START_MARKER = '<<JSON_START>>';
  const END_MARKER = '<<JSON_END>>';
  const startIdx = text.indexOf(START_MARKER);
  const endIdx = text.indexOf(END_MARKER);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const candidate = text.slice(startIdx + START_MARKER.length, endIdx).trim();
    try { 
      return JSON.parse(candidate); 
    } catch (e) { 
      // continue to other parsing attempts
    }
  }
  
  // Try direct JSON parse
  try {
    return JSON.parse(text);
  } catch (err) {
    // Find first balanced object/array
    const firstObj = text.indexOf('{');
    const firstArr = text.indexOf('[');
    if (firstObj === -1 && firstArr === -1) {
      const snippet = text.slice(0, 200);
      throw new Error(`No JSON object or array found in response. First 200 chars: "${snippet}"`);
    }
    
    let start = firstObj;
    let opening = '{';
    let closing = '}';
    
    if (firstObj === -1 || (firstArr !== -1 && firstArr < firstObj)) {
      start = firstArr;
      opening = '[';
      closing = ']';
    }

    let depth = 0;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === opening) depth++;
      else if (ch === closing) {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch (e) {
            break; // try next approach
          }
        }
      }
    }

    // Last resort: regex to find any complete JSON object
    const match = text.match(/\{[\s\S]*\}/m);
    if (match) {
      try { 
        return JSON.parse(match[0]); 
      } catch (e) { 
        // Fall through to final error
      }
    }

    const snippet = text.length > 300 ? text.slice(0, 300) + '...' : text;
    throw new Error(`Failed to extract valid JSON. Response: "${snippet}"`);
  }
}

async function callGemini(prompt, model = MODELS.FAST) {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not set in environment variables');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  });

  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-goog-api-key': process.env.GOOGLE_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          const text = extractGeneratedText(json);
          if (!text) return reject(new Error('No generated text found in Gemini response'));
          // DEBUG: Log first 500 chars of raw response
          logger.debug('Gemini raw response', { snippet: text.slice(0, 500) });
          resolve(text.trim());
        } catch (err) {
          return reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

/**
 * Parse a raw Job Description into structured JSON
 */
async function parseJobDescription(rawJD) {
  logger.debug('Parsing job description');

  const prompt = `You are an expert HR analyst. Parse the following job description into structured JSON.

Job Description:
${rawJD}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "title": "job title",
  "company": "company name if mentioned or null",
  "location": "location if mentioned or null",
  "experience_years": "e.g. 3-5 years or null",
  "employment_type": "full-time/part-time/contract or null",
  "required_skills": ["skill1", "skill2"],
  "preferred_skills": ["skill1", "skill2"],
  "responsibilities": ["responsibility1", "responsibility2"],
  "qualifications": ["qualification1", "qualification2"],
  "keywords": ["keyword1", "keyword2"],
  "industry": "industry sector"
}`;

  const text = await callGemini(prompt, MODELS.FAST);
  return parseJSONorExtract(text);
}

/**
 * Generate an ATS-optimized resume from JD + candidate info
 */
async function generateResume(jobDescription, candidateInfo) {
  logger.debug('Generating resume for candidate', { name: candidateInfo.name });

  const prompt = `You are a world-class resume writer specializing in ATS optimization.

Job Description:
${jobDescription}

Candidate Information:
${JSON.stringify(candidateInfo, null, 2)}

Create a highly tailored, ATS-optimized resume. Respond ONLY with valid JSON (no markdown, no explanation):
{
  "name": "full name",
  "email": "email",
  "phone": "phone",
  "location": "city, state",
  "linkedin": "linkedin url or null",
  "portfolio": "portfolio url or null",
  "summary": "2-3 sentence professional summary tailored to the JD",
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"]
  },
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "location": "city, state",
      "start_date": "MMM YYYY",
      "end_date": "MMM YYYY or Present",
      "achievements": ["achievement with metric", "achievement2"]
    }
  ],
  "education": [
    {
      "degree": "degree name",
      "institution": "institution name",
      "location": "city, state",
      "graduation_year": "YYYY",
      "gpa": "GPA if provided or null",
      "relevant_coursework": ["course1", "course2"]
    }
  ],
  "certifications": [
    {
      "name": "certification name",
      "issuer": "issuing organization",
      "year": "YYYY"
    }
  ],
  "projects": [
    {
      "name": "project name",
      "description": "brief description",
      "technologies": ["tech1", "tech2"],
      "link": "url or null"
    }
  ]
}`;

  const text = await callGemini(prompt, MODELS.QUALITY);
  return parseJSONorExtract(text);
}

/**
 * Calculate ATS score comparing JD and resume
 */
async function calculateATSScore(jobDescription, resumeText) {
  logger.debug('Calculating ATS score');

  const prompt = `You are an expert ATS (Applicant Tracking System) evaluator.

Job Description:
${jobDescription}

Resume:
${resumeText}

Perform a thorough ATS analysis. Respond ONLY with valid JSON (no markdown, no explanation):
{
  "overall_score": <number 0-100>,
  "grade": "<A/B/C/D/F>",
  "section_scores": {
    "keyword_match": <number 0-100>,
    "skills_alignment": <number 0-100>,
    "experience_relevance": <number 0-100>,
    "education_match": <number 0-100>,
    "formatting_compatibility": <number 0-100>
  },
  "matched_keywords": ["keyword1", "keyword2"],
  "missing_critical_keywords": ["keyword1", "keyword2"],
  "missing_preferred_keywords": ["keyword1", "keyword2"],
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "improvements": [
    {
      "priority": "high/medium/low",
      "section": "section name",
      "suggestion": "specific actionable suggestion"
    }
  ],
  "summary": "2-3 sentence overall assessment"
}`;

  const text = await callGemini(prompt, MODELS.QUALITY);
  return parseJSONorExtract(text);
}

/**
 * Extract text from resume for ATS analysis feedback
 */
async function improveResume(resumeText, jobDescription, atsScore) {
  logger.debug('Generating resume improvement suggestions');

  const prompt = `You are an expert resume coach. Based on the ATS analysis below, improve the resume.

Original Resume:
${resumeText}

Job Description:
${jobDescription}

Current ATS Issues:
- Missing Keywords: ${atsScore.missing_critical_keywords?.join(', ')}
- Improvements Needed: ${atsScore.improvements?.map(i => i.suggestion).join('; ')}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "improved_summary": "improved professional summary",
  "added_keywords": ["keyword1", "keyword2"],
  "rewritten_bullets": [
    {
      "original": "original bullet point",
      "improved": "improved bullet point with keywords and metrics"
    }
  ],
  "skills_to_add": ["skill1", "skill2"],
  "overall_tip": "single most impactful tip for this specific role"
}`;

  const text = await callGemini(prompt, MODELS.QUALITY);
  return JSON.parse(text);
}

module.exports = { parseJobDescription, generateResume, calculateATSScore, improveResume };
