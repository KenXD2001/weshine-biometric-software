// Load environment variables if `dotenv` is available (optional in packaged builds)
try {
  require('dotenv').config();
} catch (err) {
  // dotenv may not be bundled into the packaged app; ignore if missing
  // console.log('dotenv not available, skipping .env load');
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const logger = require('./config/logger');
const SyncScheduler = require('./services/syncScheduler');

const app = express();
const PORT = process.env.PORT;
const HOST = process.env.HOST;

// Security middleware with relaxed CSP for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", process.env.FRONTEND_URL, "data:", "blob:"], // Allow images from frontend
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests
}));
app.use(compression());

// CORS configuration
// By default allow all origins for local development. To restrict, set ALLOW_ALL_ORIGINS=false
const allowAll = process.env.ALLOW_ALL_ORIGINS === undefined || process.env.ALLOW_ALL_ORIGINS !== 'false';

if (allowAll) {
  console.log('🔐 CORS configured: echoing origin and allowing credentials (development)');
  app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    // Expose any headers you need on the client
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Kuma-Revision');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
} else {
  const corsOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://10.128.92.163:3030'];

  console.log('🔐 CORS Origins configured:', corsOrigins);

  app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-token']
  }));
}


// Body parsing middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Note: Authentication is now handled by local auth.js routes
// which forward requests to cloud backend with proper response transformation

// Serve uploaded files statically
const path = require('path');

// Use proper upload directory path like multer configuration
let uploadDir;
if (process.env.NODE_ENV === 'production' && process.resourcesPath) {
  // In packaged Electron, use resources/uploads (outside asar)
  uploadDir = path.join(process.resourcesPath, 'uploads');
} else {
  // In dev, use project uploads folder
  uploadDir = path.join(__dirname, '../uploads');
}

app.use('/uploads', express.static(uploadDir));
// also allow API clients to fetch images via /api/upload/images prefix
app.use('/api/upload/images', express.static(uploadDir));

// Custom morgan middleware for logging
morgan.token('timestamp', () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').replace('Z', '');
});

app.use(morgan(':timestamp :method :url :status :response-time ms - :res[content-length]', {
  stream: {
    write: (message) => {
      const trimmedMessage = message.trim();
      if (trimmedMessage.includes(' 4') || trimmedMessage.includes(' 5')) {
        logger.warn(`HTTP Request: ${trimmedMessage}`);
      } else {
        logger.info(`HTTP Request: ${trimmedMessage}`);
      }
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  logger.info('Health check requested', { ip: req.ip });
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api', require('./routes/api'));

// Add sync routes
app.use('/api/sync', require('./routes/sync'));

// Root endpoint
app.get('/', (req, res) => {
  logger.info('Root endpoint accessed', { ip: req.ip });
  res.json({
    message: 'Digi Biometric Backend API',
    version: process.env.API_VERSION || 'v1',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.originalUrl}`, { 
    method: req.method, 
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Initialize and start sync scheduler
const syncScheduler = new SyncScheduler();

// Start server
app.listen(PORT, HOST, () => {
  // Start sync scheduler after server is ready
  syncScheduler.start();
  
  logger.success(`Server started successfully`, {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV,
    pid: process.pid
  });
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    DIGI BIOMETRIC BACKEND                   ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on: http://${HOST}:${PORT}                    ║
║  Environment: ${(process.env.NODE_ENV).padEnd(47)} ║
║  Process ID: ${process.pid.toString().padEnd(49)} ║
║  Start Time: ${new Date().toISOString().replace('T', ' ').replace('Z', '').padEnd(43)} ║
║  Sync Scheduler: RUNNING                                        ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  syncScheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  syncScheduler.stop();
  process.exit(0);
});

module.exports = app;
