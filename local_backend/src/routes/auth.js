const express = require('express');
const axios = require('axios');
const router = express.Router();
const logger = require('../config/logger');

const CLOUD_BACKEND_URL = process.env.CLOUD_BACKEND_URL;

/**
 * Login endpoint
 * Flow: Frontend (3030) -> Local Backend (8080) -> Cloud Backend (8040)
 * 
 * Frontend sends: { email, password }
 * Cloud backend returns: { success, token, user }
 * Local backend transforms to: { successful, api_token, user }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    logger.info('🔐 Login request received - forwarding to cloud backend', { 
      email, 
      passwordProvided: !!password,
      passwordLength: password ? password.length : 0,
      cloudBackendUrl: CLOUD_BACKEND_URL,
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

    // Forward login request to cloud backend
    try {
      logger.info('📡 Forwarding login request to cloud backend', {
        url: `${CLOUD_BACKEND_URL}/api/auth/login`,
        timeout: 10000,
        timestamp: new Date().toISOString()
      });

      const cloudResponse = await axios.post(
        `${CLOUD_BACKEND_URL}/api/auth/login`,
        { 
          email, 
          password
        },
        {
          timeout: 10000
        }
      );

      logger.success('✅ Login successful from cloud backend', { 
        email, 
        ip: req.ip,
        responseStatus: cloudResponse.status,
        responseTime: new Date().toISOString(),
        hasToken: !!(cloudResponse.data?.data?.token),
        userData: cloudResponse.data?.data?.user ? {
          id: cloudResponse.data.data.user.id,
          centreCode: cloudResponse.data.data.user.centreCode,
          centreName: cloudResponse.data.data.user.centreName,
          role: cloudResponse.data.data.user.role
        } : null
      });


      // Transform cloud backend response to match frontend expectations
      const transformedResponse = {
        successful: cloudResponse.data.success === true,
        message: cloudResponse.data.message,
        data: {
          api_token: cloudResponse.data.data.token,
          user: cloudResponse.data.data.user || {}
        }
      };

      logger.info('Sending transformed response to frontend', {
        success: transformedResponse.successful,
        hasApiToken: !!transformedResponse.data.api_token,
        hasUser: !!transformedResponse.data.user,
        responseSize: JSON.stringify(transformedResponse).length,
        timestamp: new Date().toISOString()
      });

      res.status(200).json(transformedResponse);

    } catch (cloudError) {
      const errorMessage = cloudError.response?.data?.message || cloudError.message;
      const statusCode = cloudError.response?.status || 500;

      logger.error('❌ Cloud backend login failed', { 
        email,
        error: errorMessage,
        statusCode,
        cloudBackendUrl: CLOUD_BACKEND_URL,
        axiosCode: cloudError.code,
        axiosStatus: cloudError.response?.status,
        axiosStatusText: cloudError.response?.statusText,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      const errorResponse = {
        successful: false,
        message: errorMessage || 'Cloud authentication service failed'
      };

      logger.warn('📤 Sending error response to frontend', {
        success: errorResponse.successful,
        message: errorResponse.message,
        statusCode,
        timestamp: new Date().toISOString()
      });

      return res.status(statusCode).json(errorResponse);
    }

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
 * Forwards to cloud backend for token verification
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

    logger.info('Verifying token with cloud backend', { ip: req.ip });

    const cloudResponse = await axios.get(
      `${CLOUD_BACKEND_URL}/api/auth/verify`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      }
    );

    res.json({
      successful: true,
      message: 'Token verified',
      data: cloudResponse.data.data
    });

  } catch (error) {
    const statusCode = error.response?.status || 500;
    const message = error.response?.data?.message || 'Token verification failed';

    logger.warn('Token verification failed', { 
      error: message,
      statusCode,
      ip: req.ip 
    });

    res.status(statusCode).json({
      successful: false,
      message
    });
  }
});

/**
 * Logout endpoint
 * Forwards to cloud backend
 */
router.post('/logout', async (req, res) => {
  try {
    logger.info('User logout request', { ip: req.ip });

    const token = req.headers.authorization?.replace('Bearer ', '');
    
    // If token exists, attempt to notify cloud backend
    if (token) {
      try {
        await axios.post(
          `${CLOUD_BACKEND_URL}/api/auth/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000
          }
        );
      } catch (cloudError) {
        // Log but don't fail if cloud backend logout fails
        logger.warn('Cloud backend logout notification failed', { 
          error: cloudError.message,
          ip: req.ip 
        });
      }
    }

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
