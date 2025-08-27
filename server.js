if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const logger = require('./utils/logger');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const stripeWebhookRoutes = require('./routes/StripeWebhook');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cors = require('cors');
const path = require('path');

// Middleware
const { globalErrorHandler, undefinedRouteHandler } = require('./middleware/errorMiddleware');
const connectDB = require('./config/database');

// Initialize
const app = express();

// Trust proxy for rate limiting (fixes X-Forwarded-For warnings)
app.set('trust proxy', 1);

console.log('Express app initialized');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

// ─── Security Headers ─────────────────────────────────────────────
app.use(helmet());

// ─── Health & Misc ────────────────────────────────────────────────
app.get('/favicon.ico', (req, res) => res.status(204).end());
// Test/health route
app.get('/test', (req, res) => {
  res.status(200).json({
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// ─── CORS ─────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// ─── Body & Cookie Parsers ────────────────────────────────────────
app.use('/stripe/webhook', stripeWebhookRoutes);
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// ─── Data Sanitization ────────────────────────────────────────────
app.use(mongoSanitize());
app.use(xss());
app.use(hpp({ whitelist: [] }));

// ─── Rate Limiting ────────────────────────────────────────────────
app.use('/api', rateLimit({
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15) * 60 * 1000,
  message: 'Too many requests from this IP, please try again later!',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true
}));

// ─── Compression ──────────────────────────────────────────────────
app.use(compression());

// ─── Logger ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    user: req.user?.id
  });
  next();
});

// ─── Static Files ─────────────────────────────────────────────────
// Only serve static files if the frontend directory exists
const frontendPath = path.join(__dirname, '../frontend');
if (require('fs').existsSync(frontendPath)) {
  app.use(express.static('frontend'));

  app.get('/stripe', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/stripe.html'));
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
} else {
  // If no frontend directory exists (like on Vercel), provide a simple API response
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Brand Appeal Backend API is running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        user: '/api/user',
        content: '/api/content',
        faqs: '/api/faqs',
        stripe: '/api/stripe',
        plans: '/api/plans',
        canva: '/api/canva',
        templates: '/api/templates',
        adminTemplates: '/api/admin/templates'
      }
    });
  });
}

// ─── Routes ───────────────────────────────────────────────────────
const routes = require('./routes/index');
app.use('/api', routes);

// ─── 404 & Global Error Handlers ──────────────────────────────────
app.all('*', undefinedRouteHandler);
app.use(globalErrorHandler);

// Export the app for serverless platforms (no app.listen here)
module.exports = app;

// Start server only when running locally (not in Vercel serverless)
if (require.main === module) {
  const startServer = async () => {
    try {
      // Connect to database first
      await connectDB();

      const PORT = process.env.PORT || 5000;
      const BASE_URL = process.env.BASE_URL || 'http://localhost';
      const server = app.listen(PORT, () =>
        console.log(`Server running on ${BASE_URL}:${PORT}`)
      );

      process.on('unhandledRejection', (err) => {
        logger.error('UNHANDLED REJECTION! Shutting down...', {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
        server.close(() => process.exit(1));
      });

      process.on('SIGTERM', () => {
        logger.info('SIGTERM RECEIVED. Shutting down gracefully');
        server.close(() => {
          logger.info('Process terminated!');
        });
      });
    } catch (error) {
      logger.error('Failed to start server:', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  };

  startServer();
}