// src/controllers/analyticsController.js - Analytics business logic
const Analytics = require('../models/Analytics');

/**
 * Track a single click event
 * POST /api/track
 */
const trackClick = async (req, res) => {
  try {
    const { 
      shortCode, 
      userAgent, 
      referer, 
      ipAddress, 
      country,
      city,
      acceptLanguage,
      timestamp 
    } = req.body;

    // Validate required fields
    if (!shortCode) {
      return res.status(400).json({
        success: false,
        message: 'Short code is required'
      });
    }

    // Create analytics entry
    const analyticsEntry = new Analytics({
      shortCode,
      userAgent: userAgent || 'unknown',
      referer: referer || 'direct',
      ipAddress: ipAddress || 'unknown',
      country: country || null,
      city: city || null,
      acceptLanguage: acceptLanguage || 'unknown',
      clickedAt: timestamp ? new Date(timestamp) : new Date()
    });

    await analyticsEntry.save();

    res.status(201).json({
      success: true,
      message: 'Click tracked successfully',
      data: {
        id: analyticsEntry._id,
        shortCode: analyticsEntry.shortCode,
        clickedAt: analyticsEntry.clickedAt
      }
    });

  } catch (error) {
    console.error('Error in trackClick:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking click',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Track multiple clicks in batch
 * POST /api/track/batch
 */
const trackClicksBatch = async (req, res) => {
  try {
    const { clicks } = req.body;

    if (!Array.isArray(clicks) || clicks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Clicks array is required and must not be empty'
      });
    }

    // Validate each click has a shortCode
    const invalidClicks = clicks.filter(click => !click.shortCode);
    if (invalidClicks.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All clicks must have a shortCode'
      });
    }

    // Prepare analytics entries
    const analyticsEntries = clicks.map(click => ({
      shortCode: click.shortCode,
      userAgent: click.userAgent || 'unknown',
      referer: click.referer || 'direct',
      ipAddress: click.ipAddress || 'unknown',
      country: click.country || null,
      city: click.city || null,
      acceptLanguage: click.acceptLanguage || 'unknown',
      clickedAt: click.timestamp ? new Date(click.timestamp) : new Date()
    }));

    // Bulk insert
    const result = await Analytics.insertMany(analyticsEntries);

    res.status(201).json({
      success: true,
      message: `${result.length} clicks tracked successfully`,
      data: {
        tracked: result.length
      }
    });

  } catch (error) {
    console.error('Error in trackClicksBatch:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking clicks batch',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get analytics for a specific short code
 * GET /api/analytics/:shortCode
 */
const getAnalytics = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const { startDate, endDate, detailed } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // Get analytics summary
    const summary = await Analytics.getAnalyticsSummary(shortCode);

    // Get clicks over time
    const clicksOverTime = await Analytics.getClicksOverTime(shortCode, 30);

    const response = {
      success: true,
      data: {
        shortCode,
        summary: {
          totalClicks: summary.totalClicks,
          uniqueVisitors: summary.uniqueVisitors
        },
        clicksOverTime,
        demographics: {
          countries: summary.clicksByCountry,
          devices: summary.clicksByDevice
        },
        referrers: summary.topReferrers
      }
    };

    // Add detailed information if requested
    if (detailed === 'true') {
      const clicksByBrowser = await Analytics.getClicksByBrowser(shortCode);
      response.data.demographics.browsers = clicksByBrowser;

      // Get recent clicks
      const recentClicks = await Analytics.find({ shortCode })
        .sort({ clickedAt: -1 })
        .limit(100)
        .select('clickedAt userAgent referer country deviceType');
      
      response.data.recentClicks = recentClicks;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in getAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get aggregated analytics across all URLs
 * GET /api/analytics/aggregate
 */
const getAggregatedAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const matchStage = Object.keys(dateFilter).length > 0
      ? { clickedAt: dateFilter }
      : {};

    // Aggregate data
    const [totalClicks, uniqueUrls, topCountries, topDevices] = await Promise.all([
      // Total clicks
      Analytics.countDocuments(matchStage),
      
      // Unique URLs
      Analytics.distinct('shortCode', matchStage),
      
      // Top countries
      Analytics.aggregate([
        { $match: matchStage },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, country: '$_id', count: 1 } }
      ]),
      
      // Top devices
      Analytics.aggregate([
        { $match: matchStage },
        { $group: { _id: '$deviceType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, deviceType: '$_id', count: 1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalClicks,
        uniqueUrls: uniqueUrls.length,
        topCountries,
        topDevices,
        period: {
          startDate: startDate || 'all time',
          endDate: endDate || 'now'
        }
      }
    });

  } catch (error) {
    console.error('Error in getAggregatedAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving aggregated analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get top performing URLs
 * GET /api/analytics/top
 */
const getTopUrls = async (req, res) => {
  try {
    const { limit = 10, period = 'all' } = req.query;

    // Calculate date filter based on period
    const dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'day':
        dateFilter.$gte = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        dateFilter.$gte = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        dateFilter.$gte = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        // 'all' - no date filter
        break;
    }

    const matchStage = Object.keys(dateFilter).length > 0
      ? { clickedAt: dateFilter }
      : {};

    // Get top URLs by click count
    const topUrls = await Analytics.aggregate([
      { $match: matchStage },
      { 
        $group: { 
          _id: '$shortCode',
          clicks: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          lastClick: { $max: '$clickedAt' }
        } 
      },
      {
        $project: {
          _id: 0,
          shortCode: '$_id',
          clicks: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
          lastClick: 1
        }
      },
      { $sort: { clicks: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.status(200).json({
      success: true,
      data: {
        topUrls,
        period,
        count: topUrls.length
      }
    });

  } catch (error) {
    console.error('Error in getTopUrls:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving top URLs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete analytics for a specific short code
 * DELETE /api/analytics/:shortCode
 */
const deleteAnalytics = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const result = await Analytics.deleteMany({ shortCode });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} analytics entries for ${shortCode}`
    });

  } catch (error) {
    console.error('Error in deleteAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Health check for analytics service
 * GET /api/health
 */
const healthCheck = async (req, res) => {
  try {
    const dbConnected = require('mongoose').connection.readyState === 1;
    
    const totalEvents = await Analytics.countDocuments();
    const uniqueUrls = await Analytics.distinct('shortCode');

    res.status(200).json({
      success: true,
      service: 'analytics-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        totalEvents,
        uniqueUrls: uniqueUrls.length
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
      service: 'analytics-service',
      status: 'unhealthy',
      error: error.message
    });
  }
};

module.exports = {
  trackClick,
  trackClicksBatch,
  getAnalytics,
  getAggregatedAnalytics,
  getTopUrls,
  deleteAnalytics,
  healthCheck
};