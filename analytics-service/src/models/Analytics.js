// src/models/Analytics.js - MongoDB schema for click tracking
const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  shortCode: {
    type: String,
    required: [true, 'Short code is required'],
    index: true,
    trim: true
  },

  clickedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  userAgent: {
    type: String,
    default: 'unknown'
  },

  // Browser information parsed from user agent
  browser: {
    name: String,
    version: String
  },

  // Operating system information
  os: {
    name: String,
    version: String
  },

  // Device type (mobile, tablet, desktop)
  deviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop', 'unknown'],
    default: 'unknown'
  },

  referer: {
    type: String,
    default: 'direct'
  },

  // IP address (anonymized in production)
  ipAddress: {
    type: String,
    default: 'unknown'
  },

  // Geographic information
  country: {
    type: String,
    default: null
  },

  city: {
    type: String,
    default: null
  },

  // Language preference
  acceptLanguage: {
    type: String,
    default: 'unknown'
  },

  // Additional metadata
  metadata: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for common queries
analyticsSchema.index({ shortCode: 1, clickedAt: -1 });
analyticsSchema.index({ shortCode: 1, country: 1 });
analyticsSchema.index({ shortCode: 1, deviceType: 1 });
analyticsSchema.index({ clickedAt: -1 });

// Static method to get click count for a short code
analyticsSchema.statics.getClickCount = function(shortCode) {
  return this.countDocuments({ shortCode });
};

// Static method to get clicks within date range
analyticsSchema.statics.getClicksInRange = function(shortCode, startDate, endDate) {
  return this.find({
    shortCode,
    clickedAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ clickedAt: -1 });
};

// Static method to get unique visitors (by IP)
analyticsSchema.statics.getUniqueVisitors = async function(shortCode) {
  const result = await this.aggregate([
    { $match: { shortCode } },
    { $group: { _id: '$ipAddress' } },
    { $count: 'uniqueVisitors' }
  ]);
  
  return result[0]?.uniqueVisitors || 0;
};

// Static method to get clicks by country
analyticsSchema.statics.getClicksByCountry = function(shortCode) {
  return this.aggregate([
    { $match: { shortCode } },
    { 
      $group: { 
        _id: '$country',
        count: { $sum: 1 }
      } 
    },
    { $sort: { count: -1 } },
    { 
      $project: {
        _id: 0,
        country: '$_id',
        count: 1
      }
    }
  ]);
};

// Static method to get clicks by device type
analyticsSchema.statics.getClicksByDevice = function(shortCode) {
  return this.aggregate([
    { $match: { shortCode } },
    { 
      $group: { 
        _id: '$deviceType',
        count: { $sum: 1 }
      } 
    },
    { $sort: { count: -1 } },
    { 
      $project: {
        _id: 0,
        deviceType: '$_id',
        count: 1
      }
    }
  ]);
};

// Static method to get clicks by browser
analyticsSchema.statics.getClicksByBrowser = function(shortCode) {
  return this.aggregate([
    { $match: { shortCode } },
    { 
      $group: { 
        _id: '$browser.name',
        count: { $sum: 1 }
      } 
    },
    { $sort: { count: -1 } },
    { 
      $project: {
        _id: 0,
        browser: '$_id',
        count: 1
      }
    }
  ]);
};

// Static method to get clicks over time (grouped by day)
analyticsSchema.statics.getClicksOverTime = function(shortCode, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    { 
      $match: { 
        shortCode,
        clickedAt: { $gte: startDate }
      } 
    },
    {
      $group: {
        _id: {
          year: { $year: '$clickedAt' },
          month: { $month: '$clickedAt' },
          day: { $dayOfMonth: '$clickedAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    {
      $project: {
        _id: 0,
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        count: 1
      }
    }
  ]);
};

// Static method to get top referrers
analyticsSchema.statics.getTopReferrers = function(shortCode, limit = 10) {
  return this.aggregate([
    { $match: { shortCode } },
    { 
      $group: { 
        _id: '$referer',
        count: { $sum: 1 }
      } 
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    { 
      $project: {
        _id: 0,
        referer: '$_id',
        count: 1
      }
    }
  ]);
};

// Static method to get analytics summary
analyticsSchema.statics.getAnalyticsSummary = async function(shortCode) {
  const [
    totalClicks,
    uniqueVisitors,
    clicksByCountry,
    clicksByDevice,
    topReferrers
  ] = await Promise.all([
    this.getClickCount(shortCode),
    this.getUniqueVisitors(shortCode),
    this.getClicksByCountry(shortCode),
    this.getClicksByDevice(shortCode),
    this.getTopReferrers(shortCode, 5)
  ]);

  return {
    totalClicks,
    uniqueVisitors,
    clicksByCountry,
    clicksByDevice,
    topReferrers
  };
};

// Pre-save middleware to parse user agent
analyticsSchema.pre('save', function(next) {
  if (this.userAgent && this.userAgent !== 'unknown') {
    // Simple user agent parsing (in production, use a library like 'ua-parser-js')
    const ua = this.userAgent.toLowerCase();
    
    // Detect browser
    if (ua.includes('chrome')) {
      this.browser.name = 'Chrome';
    } else if (ua.includes('firefox')) {
      this.browser.name = 'Firefox';
    } else if (ua.includes('safari')) {
      this.browser.name = 'Safari';
    } else if (ua.includes('edge')) {
      this.browser.name = 'Edge';
    } else {
      this.browser.name = 'Other';
    }

    // Detect OS
    if (ua.includes('windows')) {
      this.os.name = 'Windows';
    } else if (ua.includes('mac')) {
      this.os.name = 'macOS';
    } else if (ua.includes('linux')) {
      this.os.name = 'Linux';
    } else if (ua.includes('android')) {
      this.os.name = 'Android';
    } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
      this.os.name = 'iOS';
    } else {
      this.os.name = 'Other';
    }

    // Detect device type
    if (ua.includes('mobile') || ua.includes('android')) {
      this.deviceType = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      this.deviceType = 'tablet';
    } else {
      this.deviceType = 'desktop';
    }
  }
  
  next();
});

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;