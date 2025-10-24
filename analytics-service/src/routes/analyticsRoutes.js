// src/routes/analyticsRoutes.js - API route definitions
const express = require('express');
const router = express.Router();

// Import controllers
const {
  trackClick,
  trackClicksBatch,
  getAnalytics,
  getAggregatedAnalytics,
  getTopUrls,
  deleteAnalytics,
  healthCheck
} = require('../controllers/analyticsController');

// Import middleware
const { validateTrackClick, validateShortCode } = require('../middleware/validation');

/**
 * @route   POST /api/track
 * @desc    Track a single click event
 * @access  Public
 * @body    { shortCode: string, userAgent?: string, referer?: string, ... }
 */
router.post('/track', validateTrackClick, trackClick);

/**
 * @route   POST /api/track/batch
 * @desc    Batch track multiple click events
 * @access  Public
 * @body    { clicks: Array<ClickData> }
 */
router.post('/track/batch', trackClicksBatch);

/**
 * @route   GET /api/analytics/:shortCode
 * @desc    Get analytics for a specific short code
 * @access  Public
 * @params  shortCode - The short code to get analytics for
 * @query   startDate, endDate, detailed
 */
router.get('/analytics/:shortCode', validateShortCode, getAnalytics);

/**
 * @route   GET /api/analytics/aggregate
 * @desc    Get aggregated analytics across all URLs
 * @access  Public
 * @query   startDate, endDate
 */
router.get('/analytics/aggregate', getAggregatedAnalytics);

/**
 * @route   GET /api/analytics/top
 * @desc    Get top performing URLs
 * @access  Public
 * @query   limit, period (day, week, month, year, all)
 */
router.get('/analytics/top', getTopUrls);

/**
 * @route   DELETE /api/analytics/:shortCode
 * @desc    Delete analytics for a specific short code
 * @access  Public (should be protected in production)
 * @params  shortCode - The short code to delete analytics for
 */
router.delete('/analytics/:shortCode', validateShortCode, deleteAnalytics);

/**
 * @route   GET /api/health
 * @desc    Service health check
 * @access  Public
 */
router.get('/health', healthCheck);

module.exports = router;