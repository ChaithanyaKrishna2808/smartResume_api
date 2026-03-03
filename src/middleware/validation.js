const Joi = require('joi');

const schemas = {
  parseJD: Joi.object({
    jobDescription: Joi.string().min(50).max(10000).required()
  }),

  generateResume: Joi.object({
    jobDescription: Joi.string().min(50).max(10000).required(),
    candidateInfo: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().min(7).max(20).optional(),
      location: Joi.string().max(100).optional(),
      linkedin: Joi.string().uri().optional().allow(''),
      portfolio: Joi.string().uri().optional().allow(''),
      summary: Joi.string().max(1000).optional().allow(''),
      skills: Joi.array().items(Joi.string()).optional(),
      experience: Joi.array().items(Joi.object({
        title: Joi.string().required(),
        company: Joi.string().required(),
        location: Joi.string().optional().allow(''),
        start_date: Joi.string().required(),
        end_date: Joi.string().required(),
        description: Joi.string().optional().allow('')
      })).optional(),
      education: Joi.array().items(Joi.object({
        degree: Joi.string().required(),
        institution: Joi.string().required(),
        location: Joi.string().optional().allow(''),
        graduation_year: Joi.string().required(),
        gpa: Joi.string().optional().allow('')
      })).optional(),
      certifications: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        issuer: Joi.string().optional().allow(''),
        year: Joi.string().optional().allow('')
      })).optional(),
      projects: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        description: Joi.string().optional().allow(''),
        technologies: Joi.array().items(Joi.string()).optional(),
        link: Joi.string().uri().optional().allow('')
      })).optional()
    }).required()
  }),

  atsScore: Joi.object({
    jobDescription: Joi.string().min(50).max(10000).required(),
    resumeText: Joi.string().min(50).max(15000).required()
  }),

  exportPDF: Joi.object({
    resumeData: Joi.object().required()
  })
};

function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    next();
  };
}

module.exports = { validate };
