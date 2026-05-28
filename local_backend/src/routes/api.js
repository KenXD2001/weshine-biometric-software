const express = require('express');
const router = express.Router();
const logger = require('../config/logger');

// Import route modules
const authRoutes = require('./auth');
const candidatesModule = require('./candidates');
const biometricRoutes = require('./biometric');
const labRoutes = require('./labs');
const uploadRoutes = require('./upload');

// Middleware for API logging
router.use((req, res, next) => {
  logger.info(`API Request: ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Route mounting - Auth routes for local backend
router.use('/user', authRoutes);
router.use('/auth', authRoutes); // Also support /api/auth for backward compatibility
router.use('/candidate-details', candidatesModule.router);
router.use('/candidates', candidatesModule.router); // Backward compatibility with old client path
router.use('/candidate-counts', candidatesModule.router); // Add counts route
router.use('/biometric-details', biometricRoutes);
router.use('/lab-seating', labRoutes);
router.use('/lab-details', labRoutes);
router.use('/exam-centre', require('./examCentre'));
router.use('/upload', uploadRoutes);

// API info endpoint
router.get('/', (req, res) => {
  logger.info('API info endpoint accessed');
  res.json({
    message: 'Digi Biometric API',
    version: process.env.API_VERSION || 'v1',
    endpoints: {
      auth: '/api/user',
      candidates: '/api/candidate-details',
      biometric: '/api/biometric-details',
      labs: '/api/lab-seating',
      upload: '/api/upload'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
