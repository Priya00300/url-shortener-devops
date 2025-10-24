// src/middleware/validation.js - Input validation middleware
const Joi = require('joi');

/**
 * Schema for tracking a click event
 */
const trackClickSchema = Joi.object({
  shortCode: Joi.string()
    .min(3)
    .max(20)
    .required()
    .messages({
      'string.empty': 'Short code is required',
      'string.min': 'Short code must be at least 3 characters',
      'string.max': 'Short code cannot exceed 20 characters',
      'any.required': 'Short code is required'
    }),
  
  userAgent: Joi.string()
    .optional()
    .allow('')
    .default('unknown'),
  
  referer: Joi.string()
    .optional()
    .allow('')
    .default('direct'),
  
  ipAddress: Joi.string()
    .ip({ version: ['ipv4', 'ipv6'] })
    .optional()
    .allow('')
    .default('unknown'),
  
  country: Joi.string()
    .max(100)
    .optional()
    .allow(null, ''),
  
  city: Joi.string()
    .max(100)
    .optional()
    .allow(null, ''),
  
  acceptLanguage: Joi.string()
    .optional()
    .allow('')
    .default('unknown'),
  
  timestamp: Joi.date()
    .optional()
    .default(() => new Date())
});

/**
 * Schema for short code parameter validation
 */
const shortCodeSchema = Joi.object({
  shortCode: Joi.string()
    .min(3)
    .max(20)
    .pattern(/^[a-zA-Z0-9-]+$/)
    .required()
    .messages({
      'string.empty': 'Short code is required',
      'string.min': 'Short code must be at least 3 characters',
      'string.max': 'Short code cannot exceed 20 characters',
      'string.pattern.base': 'Invalid short code format',
      'any.required': 'Short code is required'
    })
});

/**
 * Schema for batch click tracking
 */
const trackClicksBatchSchema = Joi.object({
  clicks: Joi.array()
    .items(trackClickSchema)
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'At least one click is required',
      'array.max': 'Cannot track more than 1000 clicks at once',
      'any.required': 'Clicks array is required'
    })
});

/**
 * Schema for date range queries
 */
const dateRangeSchema = Joi.object({
  startDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Start date must be a valid date'
    }),
  
  endDate: Joi.date()
    .optional()
    .min(Joi.ref('startDate'))
    .messages({
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be after start date'
    }),
  
  detailed: Joi.boolean()
    .optional()
    .default(false)
});

/**
 * Schema for top URLs query
 */
const topUrlsSchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  
  period: Joi.string()
    .valid('day', 'week', 'month', 'year', 'all')
    .optional()
    .default('all')
    .messages({
      'any.only': 'Period must be one of: day, week, month, year, all'
    })
});

/**
 * Middleware to validate track click request
 */
const validateTrackClick = (req, res, next) => {
  const { error, value } = trackClickSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  req.body = value;
  next();
};

/**
 * Middleware to validate batch tracking request
 */
const validateTrackClicksBatch = (req, res, next) => {
  const { error, value } = trackClicksBatchSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  req.body = value;
  next();
};

/**
 * Middleware to validate short code parameter
 */
const validateShortCode = (req, res, next) => {
  const { error, value } = shortCodeSchema.validate(req.params, {
    abortEarly: false
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  req.params = value;
  next();
};

/**
 * Middleware to validate date range query parameters
 */
const validateDateRange = (req, res, next) => {
  const { error, value } = dateRangeSchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  req.query = value;
  next();
};

/**
 * Middleware to validate top URLs query parameters
 */
const validateTopUrlsQuery = (req, res, next) => {
  const { error, value } = topUrlsSchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  req.query = value;
  next();
};

/**
 * Middleware to sanitize user input
 */
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).reduce((acc, key) => {
        acc[key] = sanitize(obj[key]);
        return acc;
      }, {});
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.params = sanitize(req.params);
  req.query = sanitize(req.query);
  
  next();
};

module.exports = {
  validateTrackClick,
  validateTrackClicksBatch,
  validateShortCode,
  validateDateRange,
  validateTopUrlsQuery,
  sanitizeInput,
  trackClickSchema,
  shortCodeSchema,
  dateRangeSchema,
  topUrlsSchema
};