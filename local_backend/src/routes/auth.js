const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const logger = require('../config/logger');

const {
  LOCAL_USER_EMAIL,
  LOCAL_USER_PASSWORD,
  LOCAL_USER_ID = 'local-admin',
  LOCAL_USER_NAME = 'Local Admin',
  LOCAL_USER_ROLE = 'admin',
  JWT_SECRET = 'your-super-secret-jwt-key-here',
  JWT_EXPIRES_IN = '24h'
} = process.env;

const getLocalUser = () => ({
  id: LOCAL_USER_ID,
  name: LOCAL_USER_NAME,
  email: LOCAL_USER_EMAIL,
  role: LOCAL_USER_ROLE,
  centreCode: '',
  centreName: ''
});

const createToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Login endpoint
 * Local authentication using credentials stored in backend .env
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    logger.info('🔐 Local login request received', {
      email,
      passwordProvided: !!password,
      passwordLength: password ? password.length : 0,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    if (!email || !password) {
      logger.warn('❌ Login failed - missing credentials', {
        email,
        passwordProvided: !!password,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        successful: false,
        message: 'Email and password are required'
      });
    }

    if (email !== LOCAL_USER_EMAIL || password !== LOCAL_USER_PASSWORD) {
      logger.warn('❌ Login failed - invalid credentials', {
        email,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      return res.status(401).json({
        successful: false,
        message: 'Invalid login credentials'
      });
    }

    const user = getLocalUser();
    const token = createToken(user);

    const responseBody = {
      successful: true,
      message: 'Login successful',
      data: {
        api_token: token,
        user,
        centreCode: user.centreCode,
        centreName: user.centreName
      }
    };

    logger.success('✅ Local login successful', {
      email,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      hasToken: true,
      user
    });

    return res.status(200).json(responseBody);
  } catch (error) {
    logger.error('Local backend login error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    res.status(500).json({
      successful: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Verify token endpoint
 * Local JWT verification only
 */
router.post('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn('Token verification failed - no token provided', { ip: req.ip });
      return res.status(401).json({
        successful: false,
        message: 'No token provided'
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      logger.warn('Token verification failed - invalid token', { ip: req.ip, error: err.message });
      return res.status(401).json({
        successful: false,
        message: 'Invalid or expired token'
      });
    }

    const user = getLocalUser();

    res.json({
      successful: true,
      message: 'Token verified',
      data: {
        user,
        tokenData: decoded
      }
    });
  } catch (error) {
    logger.error('Token verification error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({
      successful: false,
      message: 'Token verification failed'
    });
  }
});

/**
 * Logout endpoint
 */
router.post('/logout', async (req, res) => {
  try {
    logger.info('Local user logout request', { ip: req.ip });
    res.json({
      successful: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error', { error: error.message, ip: req.ip });
    res.status(500).json({
      successful: false,
      message: 'Logout failed'
    });
  }
});

module.exports = router;
