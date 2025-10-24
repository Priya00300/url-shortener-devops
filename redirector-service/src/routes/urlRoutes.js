// src/routes/urlRoutes.js - API route definitions
const express = require('express');
const router = express.Router();

// Import controllers
const {
  shortenUrl,
  redirectUrl,
  getUrlInfo,
  deleteUrl,
  getAllUrls,
  healthCheck
} = require('../controllers/urlController');

// Import middleware
const { validateShortenUrl, validateShortCode } = require('../middleware/validation');

/**
 * @route   POST /api/shorten
 * @desc    Create a shortened URL
 * @access  Public
 * @body    { originalUrl: string, customAlias?: string, expiresInDays?: number }
 */
router.post('/shorten', validateShortenUrl, shortenUrl);

/**
 * @route   GET /api/:shortCode
 * @desc    Redirect to original URL
 * @access  Public
 * @params  shortCode - The short code or custom alias
 */
router.get('/:shortCode', validateShortCode, redirectUrl);

/**
 * @route   GET /api/info/:shortCode
 * @desc    Get information about a short URL
 * @access  Public
 * @params  shortCode - The short code or custom alias
 */
router.get('/info/:shortCode', validateShortCode, getUrlInfo);

/**
 * @route   DELETE /api/:shortCode
 * @desc    Deactivate a short URL
 * @access  Public (should be protected in production)
 * @params  shortCode - The short code or custom alias
 */
router.delete('/:shortCode', validateShortCode, deleteUrl);

/**
 * @route   GET /api/urls
 * @desc    Get all URLs with pagination
 * @access  Public (should be protected in production)
 * @query   page, limit, sortBy, order
 */
router.get('/urls', getAllUrls);

/**
 * @route   GET /api/health
 * @desc    Service health check
 * @access  Public
 */
router.get('/health', healthCheck);

module.exports = router;