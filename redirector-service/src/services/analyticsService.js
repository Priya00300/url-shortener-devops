// src/services/analyticsService.js - Client for analytics-service communication
const axios = require('axios');

// Analytics service configuration
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3002';
const TIMEOUT = 5000; // 5 seconds timeout
const MAX_RETRIES = 3;

// Create axios instance with default config
const analyticsClient = axios.create({
  baseURL: ANALYTICS_SERVICE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Track a click event
 * @param {Object} clickData - Click metadata
 * @returns {Promise<Object>} Response from analytics service
 */
const trackClick = async (clickData, retries = 0) => {
  try {
    const response = await analyticsClient.post('/api/track', clickData);
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error(`Analytics tracking failed (attempt ${retries + 1}):`, error.message);
    
    // Retry logic for network failures
    if (retries < MAX_RETRIES && isRetryableError(error)) {
      console.log(`Retrying analytics tracking... (${retries + 1}/${MAX_RETRIES})`);
      await sleep(1000 * (retries + 1)); // Exponential backoff
      return trackClick(clickData, retries + 1);
    }
    
    // Don't throw error - analytics failure shouldn't break redirect
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get analytics for a specific short code
 * @param {string} shortCode - The short code to get analytics for
 * @returns {Promise<Object>} Analytics data
 */
const getAnalytics = async (shortCode) => {
  try {
    const response = await analyticsClient.get(`/api/analytics/${shortCode}`);
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error('Error fetching analytics:', error.message);
    
    if (error.response) {
      // Analytics service returned an error
      return {
        success: false,
        error: error.response.data?.message || 'Analytics service error'
      };
    }
    
    // Network error or service unavailable
    return {
      success: false,
      error: 'Analytics service unavailable'
    };
  }
};

/**
 * Get aggregated analytics
 * @param {Object} filters - Filter options (dateRange, etc.)
 * @returns {Promise<Object>} Aggregated analytics data
 */
const getAggregatedAnalytics = async (filters = {}) => {
  try {
    const response = await analyticsClient.get('/api/analytics/aggregate', {
      params: filters
    });
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error('Error fetching aggregated analytics:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check if analytics service is healthy
 * @returns {Promise<boolean>} True if healthy, false otherwise
 */
const checkHealth = async () => {
  try {
    const response = await analyticsClient.get('/health', {
      timeout: 3000 // Shorter timeout for health checks
    });
    
    return response.status === 200 && response.data?.status === 'OK';
    
  } catch (error) {
    console.error('Analytics service health check failed:', error.message);
    return false;
  }
};

/**
 * Batch track multiple clicks (for bulk operations)
 * @param {Array} clicksData - Array of click data objects
 * @returns {Promise<Object>} Batch tracking result
 */
const trackClicksBatch = async (clicksData) => {
  try {
    const response = await analyticsClient.post('/api/track/batch', {
      clicks: clicksData
    });
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error('Batch tracking failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get top performing URLs
 * @param {number} limit - Number of top URLs to return
 * @param {string} period - Time period (day, week, month, all)
 * @returns {Promise<Object>} Top URLs data
 */
const getTopUrls = async (limit = 10, period = 'all') => {
  try {
    const response = await analyticsClient.get('/api/analytics/top', {
      params: { limit, period }
    });
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error('Error fetching top URLs:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Helper function to determine if error is retryable
 * @param {Error} error - The error object
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error) {
  // Retry on network errors or 5xx server errors
  if (!error.response) return true; // Network error
  
  const status = error.response.status;
  return status >= 500 && status < 600; // Server errors
}

/**
 * Helper function to sleep/delay
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initialize analytics service connection
 * Checks health and logs status
 */
const initialize = async () => {
  console.log(`Connecting to analytics service at ${ANALYTICS_SERVICE_URL}...`);
  
  const isHealthy = await checkHealth();
  
  if (isHealthy) {
    console.log('✅ Analytics service is healthy and connected');
  } else {
    console.warn('⚠️  Analytics service is not available (will continue without analytics)');
  }
  
  return isHealthy;
};

// Request interceptor for logging
analyticsClient.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Analytics Request: ${config.method.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for logging
analyticsClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Analytics Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`❌ Analytics Error: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

module.exports = {
  trackClick,
  getAnalytics,
  getAggregatedAnalytics,
  checkHealth,
  trackClicksBatch,
  getTopUrls,
  initialize,
  analyticsClient
};