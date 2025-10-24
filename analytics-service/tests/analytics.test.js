// tests/analytics.test.js - Integration tests for analytics service
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Analytics = require('../src/models/Analytics');

// Test database connection
const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/urlshortener_test';

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

beforeEach(async () => {
  await Analytics.deleteMany({});
});

describe('Analytics Service API Tests', () => {
  
  describe('POST /api/track', () => {
    
    test('should track a click event successfully', async () => {
      const clickData = {
        shortCode: 'test123',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        referer: 'https://google.com',
        ipAddress: '192.168.1.1',
        country: 'US',
        acceptLanguage: 'en-US'
      };

      const response = await request(app)
        .post('/api/track')
        .send(clickData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shortCode).toBe('test123');
      expect(response.body.data).toHaveProperty('clickedAt');
    });

    test('should track click with minimal data', async () => {
      const response = await request(app)
        .post('/api/track')
        .send({ shortCode: 'minimal' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should reject tracking without short code', async () => {
      const response = await request(app)
        .post('/api/track')
        .send({
          userAgent: 'Some User Agent'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation error');
    });

    test('should parse user agent and set device type', async () => {
      await request(app)
        .post('/api/track')
        .send({
          shortCode: 'test123',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Mobile Safari'
        })
        .expect(201);

      const analytics = await Analytics.findOne({ shortCode: 'test123' });
      expect(analytics.deviceType).toBe('mobile');
    });

  });

  describe('POST /api/track/batch', () => {
    
    test('should track multiple clicks in batch', async () => {
      const clicks = [
        { shortCode: 'test1', userAgent: 'User Agent 1' },
        { shortCode: 'test2', userAgent: 'User Agent 2' },
        { shortCode: 'test3', userAgent: 'User Agent 3' }
      ];

      const response = await request(app)
        .post('/api/track/batch')
        .send({ clicks })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tracked).toBe(3);

      const count = await Analytics.countDocuments();
      expect(count).toBe(3);
    });

    test('should reject empty clicks array', async () => {
      const response = await request(app)
        .post('/api/track/batch')
        .send({ clicks: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject batch with invalid clicks', async () => {
      const clicks = [
        { shortCode: 'valid' },
        { userAgent: 'no short code' }
      ];

      const response = await request(app)
        .post('/api/track/batch')
        .send({ clicks })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

  });

  describe('GET /api/analytics/:shortCode', () => {
    
    test('should get analytics for a short code', async () => {
      // Create some test data
      await Analytics.create([
        { shortCode: 'test123', userAgent: 'UA1', country: 'US' },
        { shortCode: 'test123', userAgent: 'UA2', country: 'UK' },
        { shortCode: 'test123', userAgent: 'UA3', country: 'US' }
      ]);

      const response = await request(app)
        .get('/api/analytics/test123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shortCode).toBe('test123');
      expect(response.body.data.summary.totalClicks).toBe(3);
      expect(response.body.data).toHaveProperty('clicksOverTime');
      expect(response.body.data).toHaveProperty('demographics');
    });

    test('should return zero clicks for non-existent short code', async () => {
      const response = await request(app)
        .get('/api/analytics/nonexistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalClicks).toBe(0);
    });

    test('should return detailed analytics when requested', async () => {
      await Analytics.create([
        { shortCode: 'detailed', userAgent: 'Chrome/120.0' },
        { shortCode: 'detailed', userAgent: 'Firefox/110.0' }
      ]);

      const response = await request(app)
        .get('/api/analytics/detailed?detailed=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.demographics).toHaveProperty('browsers');
      expect(response.body.data).toHaveProperty('recentClicks');
    });

  });

  describe('GET /api/analytics/aggregate', () => {
    
    test('should get aggregated analytics', async () => {
      await Analytics.create([
        { shortCode: 'url1', country: 'US', deviceType: 'desktop' },
        { shortCode: 'url2', country: 'UK', deviceType: 'mobile' },
        { shortCode: 'url3', country: 'US', deviceType: 'desktop' }
      ]);

      const response = await request(app)
        .get('/api/analytics/aggregate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalClicks).toBe(3);
      expect(response.body.data.uniqueUrls).toBe(3);
      expect(response.body.data).toHaveProperty('topCountries');
      expect(response.body.data).toHaveProperty('topDevices');
    });

    test('should filter aggregated analytics by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await Analytics.create([
        { shortCode: 'url1', clickedAt: yesterday },
        { shortCode: 'url2', clickedAt: new Date() },
        { shortCode: 'url3', clickedAt: tomorrow }
      ]);

      const response = await request(app)
        .get(`/api/analytics/aggregate?startDate=${new Date().toISOString()}&endDate=${tomorrow.toISOString()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalClicks).toBe(2); // Only today and tomorrow
    });

  });

  describe('GET /api/analytics/top', () => {
    
    test('should get top performing URLs', async () => {
      await Analytics.create([
        { shortCode: 'popular', ipAddress: '1.1.1.1' },
        { shortCode: 'popular', ipAddress: '2.2.2.2' },
        { shortCode: 'popular', ipAddress: '3.3.3.3' },
        { shortCode: 'medium', ipAddress: '4.4.4.4' },
        { shortCode: 'medium', ipAddress: '5.5.5.5' },
        { shortCode: 'low', ipAddress: '6.6.6.6' }
      ]);

      const response = await request(app)
        .get('/api/analytics/top?limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.topUrls).toHaveLength(2);
      expect(response.body.data.topUrls[0].shortCode).toBe('popular');
      expect(response.body.data.topUrls[0].clicks).toBe(3);
    });

    test('should filter top URLs by period', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await Analytics.create([
        { shortCode: 'old', clickedAt: yesterday },
        { shortCode: 'new', clickedAt: new Date() },
        { shortCode: 'new', clickedAt: new Date() }
      ]);

      const response = await request(app)
        .get('/api/analytics/top?period=day')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.topUrls[0].shortCode).toBe('new');
    });

  });

  describe('DELETE /api/analytics/:shortCode', () => {
    
    test('should delete analytics for a short code', async () => {
      await Analytics.create([
        { shortCode: 'delete-me' },
        { shortCode: 'delete-me' },
        { shortCode: 'keep-me' }
      ]);

      const response = await request(app)
        .delete('/api/analytics/delete-me')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('2');

      const remaining = await Analytics.countDocuments();
      expect(remaining).toBe(1);
    });

  });

  describe('GET /health', () => {
    
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('analytics-service');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body.database).toHaveProperty('connected');
    });

  });

});

describe('Analytics Model Tests', () => {
  
  test('should create analytics entry with valid data', async () => {
    const analytics = new Analytics({
      shortCode: 'test123',
      userAgent: 'Test User Agent'
    });

    await analytics.save();
    expect(analytics._id).toBeDefined();
    expect(analytics.clickedAt).toBeDefined();
  });

  test('should reject analytics without short code', async () => {
    const analytics = new Analytics({
      userAgent: 'Test User Agent'
    });

    try {
      await analytics.save();
      fail('Should have thrown validation error');
    } catch (error) {
      expect(error.name).toBe('ValidationError');
    }
  });

  test('should parse user agent on save', async () => {
    const analytics = new Analytics({
      shortCode: 'test',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
    });

    await analytics.save();
    expect(analytics.browser.name).toBe('Chrome');
    expect(analytics.os.name).toBe('Windows');
    expect(analytics.deviceType).toBe('desktop');
  });

  test('should detect mobile devices', async () => {
    const analytics = new Analytics({
      shortCode: 'test',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Mobile'
    });

    await analytics.save();
    expect(analytics.deviceType).toBe('mobile');
  });

  test('should get click count for short code', async () => {
    await Analytics.create([
      { shortCode: 'count-test' },
      { shortCode: 'count-test' },
      { shortCode: 'other' }
    ]);

    const count = await Analytics.getClickCount('count-test');
    expect(count).toBe(2);
  });

});