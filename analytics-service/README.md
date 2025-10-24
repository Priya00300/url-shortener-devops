# Analytics Service

URL Shortener Analytics Microservice - tracks and analyzes click events for shortened URLs.

## Features

- ✅ Track individual click events
- ✅ Batch click tracking
- ✅ Comprehensive analytics per URL
- ✅ Aggregated statistics across all URLs
- ✅ Top performing URLs
- ✅ Geographic analytics
- ✅ Device and browser detection
- ✅ Time-based analytics
- ✅ RESTful API
- ✅ MongoDB persistence

## API Endpoints

### Track Click Event
```http
POST /api/track
Content-Type: application/json

{
  "shortCode": "abc123",
  "userAgent": "Mozilla/5.0...",
  "referer": "https://google.com",
  "ipAddress": "192.168.1.1",
  "country": "US",
  "city": "New York",
  "acceptLanguage": "en-US"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Click tracked successfully",
  "data": {
    "id": "65a1b2c3d4e5f6...",
    "shortCode": "abc123",
    "clickedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Batch Track Clicks
```http
POST /api/track/batch
Content-Type: application/json

{
  "clicks": [
    { "shortCode": "abc123", "userAgent": "..." },
    { "shortCode": "xyz789", "userAgent": "..." }
  ]
}
```

### Get Analytics for URL
```http
GET /api/analytics/:shortCode?detailed=true
```

Returns comprehensive analytics including:
- Total clicks
- Unique visitors
- Clicks over time
- Geographic distribution
- Device breakdown
- Top referrers
- Browser statistics (if detailed=true)

### Get Aggregated Analytics
```http
GET /api/analytics/aggregate?startDate=2024-01-01&endDate=2024-12-31
```

Returns overall statistics across all URLs.

### Get Top Performing URLs
```http
GET /api/analytics/top?limit=10&period=week
```

Periods: `day`, `week`, `month`, `year`, `all`

### Delete Analytics
```http
DELETE /api/analytics/:shortCode
```

Removes all analytics data for a specific short code.

### Health Check
```http
GET /health
```

Returns service health status.

## Environment Variables

Create a `.env` file:

```env
NODE_ENV=development
PORT=3002
MONGODB_URI=mongodb://localhost:27017/urlshortener
```

## Installation

### Local Development

1. **Install dependencies:**
```bash
npm install
```

2. **Start MongoDB:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

3. **Create .env file** (see above)

4. **Run development server:**
```bash
npm run dev
```

5. **Run tests:**
```bash
npm test
```

### Docker

1. **Build image:**
```bash
docker build -t analytics-service .
```

2. **Run container:**
```bash
docker run -d \
  -p 3002:3002 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/urlshortener \
  --name analytics-service \
  analytics-service
```

## Project Structure

```
analytics-service/
├── src/
│   ├── controllers/
│   │   └── analyticsController.js  # Business logic
│   ├── models/
│   │   └── Analytics.js            # MongoDB schema
│   ├── routes/
│   │   └── analyticsRoutes.js      # API routes
│   └── middleware/
│       └── validation.js           # Input validation
├── tests/
│   └── analytics.test.js           # Integration tests
├── .env
├── .gitignore
├── .dockerignore
├── Dockerfile
├── package.json
└── server.js                        # Main entry point
```

## Analytics Data Schema

Each click event stores:

```javascript
{
  shortCode: String,
  clickedAt: Date,
  userAgent: String,
  browser: { name, version },
  os: { name, version },
  deviceType: String (mobile/tablet/desktop),
  referer: String,
  ipAddress: String,
  country: String,
  city: String,
  acceptLanguage: String
}
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test
```

## Development Commands

```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## Analytics Aggregation Methods

The service provides several aggregation methods:

- **Click Count**: Total clicks for a URL
- **Unique Visitors**: Based on IP address
- **Clicks by Country**: Geographic distribution
- **Clicks by Device**: Mobile vs Desktop vs Tablet
- **Clicks by Browser**: Browser breakdown
- **Clicks Over Time**: Daily trends
- **Top Referrers**: Where traffic comes from

## Integration with Redirector Service

The analytics service is called by the redirector service whenever a short URL is accessed:

```
User clicks short URL
    ↓
Redirector Service redirects
    ↓
Redirector Service calls Analytics Service (async)
    ↓
Analytics Service stores click data
```

## Performance Considerations

- Indexes on `shortCode` and `clickedAt` for fast queries
- Compound indexes for common query patterns
- Async tracking doesn't block redirects
- Batch tracking for bulk operations

## Security Features

- Input validation and sanitization
- Non-root Docker user
- IP address anonymization (production)
- Rate limiting (planned)

## Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM
- **joi**: Input validation
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment configuration

## Future Enhancements

- [ ] Real-time analytics dashboard
- [ ] Advanced user agent parsing (ua-parser-js)
- [ ] GeoIP lookup integration
- [ ] Redis caching for frequently accessed data
- [ ] WebSocket support for real-time updates
- [ ] Export analytics to CSV/JSON

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT