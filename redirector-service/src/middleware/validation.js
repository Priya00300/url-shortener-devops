// src/middleware/validation.js - Input validation middleware
const Joi = require('joi');

/**
 * URL validation regex
 * Supports http, https, and optionally www
 */
const urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

/**
 * Schema for URL shortening request
 */
const shortenUrlSchema = Joi.object({
  originalUrl: Joi.string()
    .pattern(urlPattern)
    .required()
    .messages({
      'string.empty': 'URL is required',
      'string.pattern.base': 'Please provide a valid URL (must include http:// or https://)',
      'any.required': 'URL is required'
    }),
  
  customAlias: Joi.string()
    .min(3)
    .max(20)
    .pattern(/^[a-zA-Z0-9-]+$/)
    .optional()
    .messages({
      'string.min': 'Custom alias must be at least 3 characters',
      'string.max': 'Custom alias cannot exceed 20 characters',
      'string.pattern.base': 'Custom alias can only contain letters, numbers, and hyphens'
    }),
  
  expiresInDays: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .optional()
    .messages({
      'number.base': 'Expiration must be a number',
      'number.min': 'Expiration must be at least 1 day',
      'number.max': 'Expiration cannot exceed 365 days'
    })
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
 * Middleware to validate URL shortening request
 */
const validateShortenUrl = (req, res, next) => {
  const { error, value } = shortenUrlSchema.validate(req.body, {
    abortEarly: false, // Return all errors, not just the first one
    stripUnknown: true // Remove unknown fields
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

  // Replace request body with validated and sanitized data
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

  // Replace params with validated data
  req.params = value;
  next();
};

/**
 * Middleware to validate query parameters
 */
const validateQueryParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
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
};

/**
 * Schema for pagination query parameters
 */
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'clickCount', 'originalUrl').default('createdAt'),
  order: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * Middleware to sanitize user input
 */
const sanitizeInput = (req, res, next) => {
  // Trim whitespace from all string values
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

/**
 * Custom error handler for validation errors
 */
const handleValidationError = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  next(err);
};

module.exports = {
  validateShortenUrl,
  validateShortCode,
  validateQueryParams,
  sanitizeInput,
  handleValidationError,
  paginationSchema,
  shortenUrlSchema,
  shortCodeSchema
};