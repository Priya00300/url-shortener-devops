// tests/url.test.js - Integration tests for URL shortener
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Url = require('../src/models/Url');

// Test database connection
const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/urlshortener_test';

beforeAll(async () => {
  // Connect to test database
  await mongoose.connect(TEST_MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  // Clean up and close connection
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

beforeEach(async () => {
  // Clear database before each test
  await Url.deleteMany({});
});

describe('URL Shortener API Tests', () => {
  
  describe('POST /api/shorten', () => {
    
    test('should create a short URL successfully', async () => {
      const response = await request(app)
        .post('/api/shorten')
        .send({
          originalUrl: 'https://www.example.com/very/long/url/path'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('shortCode');
      expect(response.body.data).toHaveProperty('shortUrl');
      expect(response.body.data.originalUrl).toBe('https://www.example.com/very/long/url/path');
      expect(response.body.data.shortCode).toHaveLength(6);
    });

    test('should create short URL with custom alias', async () => {
      const response = await request(app)
        .post('/api/shorten')
        .send({
          originalUrl: 'https://www.example.com',
          customAlias: 'my-custom-link'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shortCode).toBe('my-custom-link');
      expect(response.body.data.isCustom).toBe(true);
    });

    test('should create short URL with expiration', async () => {
      const response = await request(app)
        .post('/api/shorten')
        .send({
          originalUrl: 'https://www.example.com',
          expiresInDays: 7
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.expiresAt).toBeDefined();
    });

    test('should return existing URL if already shortened', async () => {
      const url = 'https://www.example.com/existing';
      
      // Create first short URL
      const firstResponse = await request(app)
        .post('/api/shorten')
        .send({ originalUrl: url })
        .expect(201);

      // Try to shorten same URL again
      const secondResponse = await request(app)
        .post('/api/shorten')
        .send({ originalUrl: url })
        .expect(200);

      expect(secondResponse.body.data.isExisting).toBe(true);
      expect(secondResponse.body.data.shortCode).toBe(firstResponse.body.data.shortCode);
    });

    test('should reject invalid URL', async () => {
      const response = await request(app)
        .post('/api/shorten')
        .send({
          originalUrl: 'not-a-valid-url'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
    });

    test('should reject missing URL', async () => {
      const response = await request(app)
        .post('/api/shorten')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject custom alias that is too short', async () => {
      const response = await request(app)
        .post('/api/shorten')
        .send({
          originalUrl: 'https://www.example.com',
          customAlias: 'ab'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject duplicate custom alias', async () => {
      const customAlias = 'my-alias';
      
      // Create first URL with custom alias
      await request(app)
        .post('/api/shorten')
        .send({
          originalUrl: 'https://www.example.com',
          customAlias
        })
        .expect(201);

      // Try to create another URL with same alias
      const response = await request(app)
        .post('/api/shorten')
        .send({
          originalUrl: 'https://www.different.com',
          customAlias
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

  });

  describe('GET /api/:shortCode', () => {
    
    test('should redirect to original URL', async () => {
      // Create a short URL first
      const createResponse = await request(app)
        .post('/api/shorten')
        .send({
          originalUrl: 'https://www.example.com/redirect-test'
        });

      const shortCode = createResponse.body.data.shortCode;

      // Test redirect
      const response = await request(app)
        .get(`/api/${shortCode}`)
        .expect(301);

      expect(response.header.location).toBe('https://www.example.com/redirect-test');
    });

    test('should return 404 for non-existent short code', async () => {
      const response = await request(app)
        .get('/api/nonexistent123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    test('should reject invalid short code format', async () => {
      const response = await request(app)
        .get('/api/ab') // Too short
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle expired URLs', async () => {
      // Create URL that already expired
      const expiredUrl = await Url.create({
        originalUrl: 'https://www.example.com',
        shortCode: 'expired1',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      });

      const response = await request(app)
        .get(`/api/${expiredUrl.shortCode}`)
        .expect(410);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('expired');
    });

    test('should increment click count on redirect', async () => {
      // Create a short URL
      const url = await Url.create({
        originalUrl: 'https://www.example.com',
        shortCode: 'test123',
        clickCount: 0
      });

      // Make redirect request
      await request(app)
        .get(`/api/${url.shortCode}`)
        .expect(301);

      // Check if click count increased
      const updatedUrl = await Url.findOne({ shortCode: 'test123' });
      expect(updatedUrl.clickCount).toBe(1);
    });

  });

  describe('GET /api/info/:shortCode', () => {
    
    test('should return URL information', async () => {
      // Create a short URL
      const createResponse = await request(app)
        .post('/api/shorten')
        .send({
          originalUrl: 'https://www.example.com/info-test'
        });

      const shortCode = createResponse.body.data.shortCode;

      // Get info
      const response = await request(app)
        .get(`/api/info/${shortCode}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shortCode).toBe(shortCode);
      expect(response.body.data.originalUrl).toBe('https://www.example.com/info-test');
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data).toHaveProperty('clickCount');
    });

    test('should return 404 for non-existent URL info', async () => {
      const response = await request(app)
        .get('/api/info/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

  });

  describe('DELETE /api/:shortCode', () => {
    
    test('should deactivate a short URL', async () => {
      // Create a short URL
      const createResponse = await request(app)
        .post('/api/shorten')
        .send({
          originalUrl: 'https://www.example.com/delete-test'
        });

      const shortCode = createResponse.body.data.shortCode;

      // Delete the URL
      const response = await request(app)
        .delete(`/api/${shortCode}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify it's deactivated
      const url = await Url.findOne({ shortCode });
      expect(url.isActive).toBe(false);
    });

    test('should return 404 when deleting non-existent URL', async () => {
      const response = await request(app)
        .delete('/api/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

  });

  describe('GET /health', () => {
    
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('redirector-service');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('database');
    });

  });

});

describe('URL Model Tests', () => {
  
  test('should create URL with valid data', async () => {
    const url = new Url({
      originalUrl: 'https://www.example.com',
      shortCode: 'test123'
    });

    await url.save();
    expect(url._id).toBeDefined();
    expect(url.isActive).toBe(true);
    expect(url.clickCount).toBe(0);
  });

  test('should reject URL without protocol', async () => {
    const url = new Url({
      originalUrl: 'www.example.com',
      shortCode: 'test123'
    });

    try {
      await url.save();
      fail('Should have thrown validation error');
    } catch (error) {
      expect(error.name).toBe('ValidationError');
    }
  });

  test('should enforce unique short codes', async () => {
    const url1 = new Url({
      originalUrl: 'https://www.example1.com',
      shortCode: 'duplicate'
    });

    await url1.save();

    const url2 = new Url({
      originalUrl: 'https://www.example2.com',
      shortCode: 'duplicate'
    });

    try {
      await url2.save();
      fail('Should have thrown duplicate key error');
    } catch (error) {
      expect(error.code).toBe(11000);
    }
  });

  test('should validate short code length', async () => {
    const url = new Url({
      originalUrl: 'https://www.example.com',
      shortCode: 'ab' // Too short
    });

    try {
      await url.save();
      fail('Should have thrown validation error');
    } catch (error) {
      expect(error.name).toBe('ValidationError');
    }
  });

  test('should check if URL is expired', async () => {
    const url = new Url({
      originalUrl: 'https://www.example.com',
      shortCode: 'test123',
      expiresAt: new Date(Date.now() - 1000) // Already expired
    });

    expect(url.isExpired).toBe(true);
  });

  test('should validate URL is not expired', async () => {
    const url = new Url({
      originalUrl: 'https://www.example.com',
      shortCode: 'test123',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires tomorrow
    });

    expect(url.isExpired).toBe(false);
  });

});