// src/controllers/urlController.js - URL business logic
const Url = require('../models/Url');
const { generateShortCode } = require('../utils/shortCodeGenerator');
const analyticsService = require('../services/analyticsService');

/**
 * Create a shortened URL
 * POST /api/shorten
 */
const shortenUrl = async (req, res) => {
  try {
    const { originalUrl, customAlias, expiresInDays } = req.body;

    // Validate original URL is provided
    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: 'Original URL is required'
      });
    }

    // Check if URL already exists (optional: return existing short code)
    const existingUrl = await Url.findOne({ originalUrl, isActive: true });
    if (existingUrl && !customAlias) {
      return res.status(200).json({
        success: true,
        message: 'URL already shortened',
        data: {
          shortCode: existingUrl.shortCode,
          shortUrl: existingUrl.shortUrl,
          originalUrl: existingUrl.originalUrl,
          createdAt: existingUrl.createdAt,
          isExisting: true
        }
      });
    }

    // Generate short code (or use custom alias)
    const { shortCode, isCustom } = await generateShortCode(customAlias);

    // Calculate expiration date if specified
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Create new URL document
    const newUrl = new Url({
      originalUrl,
      shortCode,
      customAlias: isCustom ? shortCode : null,
      expiresAt,
      createdBy: req.user?.id || 'anonymous' // For future auth implementation
    });

    // Save to database
    await newUrl.save();

    // Return success response
    res.status(201).json({
      success: true,
      message: 'URL shortened successfully',
      data: {
        shortCode: newUrl.shortCode,
        shortUrl: newUrl.shortUrl,
        originalUrl: newUrl.originalUrl,
        createdAt: newUrl.createdAt,
        expiresAt: newUrl.expiresAt,
        isCustom
      }
    });

  } catch (error) {
    console.error('Error in shortenUrl:', error);
    
    // Handle specific errors
    if (error.message.includes('Custom alias')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating short URL',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Redirect to original URL and track click
 * GET /api/:shortCode
 */
const redirectUrl = async (req, res) => {
  try {
    const { shortCode } = req.params;

    // Validate short code format
    if (!shortCode || shortCode.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Invalid short code format'
      });
    }

    // Find URL by short code or custom alias
    const url = await Url.findOne({
      $or: [
        { shortCode },
        { customAlias: shortCode }
      ]
    });

    // URL not found
    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'Short URL not found'
      });
    }

    // Check if URL is still valid
    if (!url.isValidForRedirect()) {
      return res.status(410).json({
        success: false,
        message: 'This short URL has expired or is inactive'
      });
    }

    // Collect metadata for analytics
    const clickMetadata = {
      shortCode: url.shortCode,
      timestamp: new Date(),
      userAgent: req.headers['user-agent'] || 'unknown',
      referer: req.headers['referer'] || req.headers['referrer'] || 'direct',
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      country: req.headers['cf-ipcountry'] || null, // Cloudflare header
      acceptLanguage: req.headers['accept-language'] || 'unknown'
    };

    // Track click asynchronously (don't wait for response)
    // This ensures redirect happens quickly even if analytics service is slow
    analyticsService.trackClick(clickMetadata).catch(err => {
      console.error('Failed to track click:', err.message);
      // Don't fail the redirect if analytics fails
    });

    // Increment click count locally (backup tracking)
    url.incrementClick().catch(err => {
      console.error('Failed to increment click count:', err.message);
    });

    // Perform redirect
    res.redirect(301, url.originalUrl);

  } catch (error) {
    console.error('Error in redirectUrl:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing redirect'
    });
  }
};

/**
 * Get URL information
 * GET /api/info/:shortCode
 */
const getUrlInfo = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const url = await Url.findOne({
      $or: [
        { shortCode },
        { customAlias: shortCode }
      ]
    });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'Short URL not found'
      });
    }

    // Return URL information (without sensitive data)
    res.status(200).json({
      success: true,
      data: {
        shortCode: url.shortCode,
        shortUrl: url.shortUrl,
        originalUrl: url.originalUrl,
        createdAt: url.createdAt,
        expiresAt: url.expiresAt,
        isActive: url.isActive,
        isExpired: url.isExpired,
        clickCount: url.clickCount,
        customAlias: url.customAlias
      }
    });

  } catch (error) {
    console.error('Error in getUrlInfo:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving URL information'
    });
  }
};

/**
 * Delete/deactivate a short URL
 * DELETE /api/:shortCode
 */
const deleteUrl = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const url = await Url.findOne({
      $or: [
        { shortCode },
        { customAlias: shortCode }
      ]
    });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'Short URL not found'
      });
    }

    // Soft delete - just mark as inactive
    url.isActive = false;
    await url.save();

    res.status(200).json({
      success: true,
      message: 'Short URL deactivated successfully'
    });

  } catch (error) {
    console.error('Error in deleteUrl:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting URL'
    });
  }
};

/**
 * Get all URLs (with pagination)
 * GET /api/urls
 */
const getAllUrls = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;

    const skip = (page - 1) * limit;
    const sortOrder = order === 'desc' ? -1 : 1;

    const urls = await Url.find({ isActive: true })
      .sort({ [sortBy]: sortOrder })
      .limit(parseInt(limit))
      .skip(skip)
      .select('-__v');

    const total = await Url.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      data: {
        urls,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error in getAllUrls:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving URLs'
    });
  }
};

/**
 * Health check for the service
 * GET /api/health
 */
const healthCheck = async (req, res) => {
  try {
    // Test database connection
    const dbConnected = require('mongoose').connection.readyState === 1;
    
    // Get basic stats
    const totalUrls = await Url.countDocuments();
    const activeUrls = await Url.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      service: 'redirector-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        totalUrls,
        activeUrls
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    });

  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'redirector-service',
      status: 'unhealthy',
      error: error.message
    });
  }
};

module.exports = {
  shortenUrl,
  redirectUrl,
  getUrlInfo,
  deleteUrl,
  getAllUrls,
  healthCheck
};