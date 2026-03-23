const express = require('express');
const router = express.Router();
const SyncService = require('../services/syncService');
const SyncScheduler = require('../services/syncScheduler');
const logger = require('../config/logger');

const syncService = new SyncService();
const syncScheduler = new SyncScheduler();

// POST /api/sync/biometric - Receive sync confirmation from cloud
router.post('/biometric', async (req, res) => {
  try {
    // This endpoint would handle sync confirmations from cloud
    // For now, this is mainly handled by the sync service
    res.json({
      successful: true,
      message: 'Sync endpoint ready'
    });
  } catch (error) {
    logger.error('Sync endpoint error:', error);
    res.status(500).json({
      successful: false,
      error: 'Sync endpoint error'
    });
  }
});

// GET /api/sync/status - Get sync status
router.get('/status', (req, res) => {
  try {
    const status = syncService.getSyncStatus();
    res.json({
      successful: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting sync status:', error);
    res.status(500).json({
      successful: false,
      error: 'Failed to get sync status'
    });
  }
});

// GET /api/sync/statistics - Get sync statistics
router.get('/statistics', (req, res) => {
  try {
    const statistics = syncService.getSyncStatistics();
    res.json({
      successful: true,
      data: statistics
    });
  } catch (error) {
    logger.error('Error getting sync statistics:', error);
    res.status(500).json({
      successful: false,
      error: 'Failed to get sync statistics'
    });
  }
});

// POST /api/sync/retry - Retry failed syncs
router.post('/retry', async (req, res) => {
  try {
    const results = await syncService.retryFailedSyncs();
    res.json({
      successful: true,
      data: results,
      message: `Retried ${results.retried} items: ${results.successful} successful, ${results.failed} failed`
    });
  } catch (error) {
    logger.error('Error retrying syncs:', error);
    res.status(500).json({
      successful: false,
      error: 'Failed to retry syncs'
    });
  }
});

// POST /api/sync/all - Sync all pending items
router.post('/all', async (req, res) => {
  try {
    const results = await syncService.syncAllPending();
    res.json({
      successful: true,
      data: results,
      message: `Processed ${results.length} pending items`
    });
  } catch (error) {
    logger.error('Error syncing all pending items:', error);
    res.status(500).json({
      successful: false,
      error: 'Failed to sync pending items'
    });
  }
});

// GET /api/sync/connection-test - Test cloud connection
router.get('/connection-test', async (req, res) => {
  try {
    const connectionStatus = await syncService.testCloudConnection();
    res.json({
      successful: true,
      data: connectionStatus
    });
  } catch (error) {
    logger.error('Error testing cloud connection:', error);
    res.status(500).json({
      successful: false,
      error: 'Failed to test cloud connection'
    });
  }
});

// POST /api/sync/manual - Trigger manual sync of all pending records
router.post('/manual', async (req, res) => {
  try {
    logger.info('Manual sync triggered via API', { ip: req.ip });
    const results = await syncService.syncAllPending();
    res.json({
      successful: true,
      message: 'Manual sync completed',
      data: results
    });
  } catch (error) {
    logger.error('Manual sync error', { error: error.message, stack: error.stack });
    res.status(500).json({
      successful: false,
      message: 'Manual sync failed',
      error: error.message
    });
  }
});

// GET /api/sync/scheduler-status - Get scheduler status
router.get('/scheduler-status', (req, res) => {
  try {
    const status = syncScheduler.getStatus();
    res.json({
      successful: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting scheduler status:', error);
    res.status(500).json({
      successful: false,
      error: 'Failed to get scheduler status'
    });
  }
});

// POST /api/sync/trigger-immediate - Trigger immediate sync
router.post('/trigger-immediate', async (req, res) => {
  try {
    const results = await syncScheduler.triggerImmediateSync();
    res.json({
      successful: true,
      data: results,
      message: 'Immediate sync triggered'
    });
  } catch (error) {
    logger.error('Error triggering immediate sync:', error);
    res.status(500).json({
      successful: false,
      error: 'Failed to trigger immediate sync'
    });
  }
});

// POST /api/sync/update-config - Update scheduler configuration
router.post('/update-config', (req, res) => {
  try {
    const newConfig = req.body;
    syncScheduler.updateConfiguration(newConfig);
    res.json({
      successful: true,
      message: 'Configuration updated',
      data: syncScheduler.getStatus()
    });
  } catch (error) {
    logger.error('Error updating scheduler configuration:', error);
    res.status(500).json({
      successful: false,
      error: 'Failed to update configuration'
    });
  }
});

// POST /api/sync/test-sync - Test sync functionality
router.post('/test-sync', async (req, res) => {
  try {
    logger.info('Running comprehensive sync test');
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Cloud Connection
    try {
      const connectionStatus = await syncService.testCloudConnection();
      testResults.tests.cloudConnection = {
        success: connectionStatus.connected,
        data: connectionStatus,
        message: connectionStatus.connected ? 'Cloud backend reachable' : 'Cloud backend not reachable'
      };
    } catch (error) {
      testResults.tests.cloudConnection = {
        success: false,
        error: error.message,
        message: 'Cloud connection test failed'
      };
    }

    // Test 2: Sync State Manager
    try {
      const syncStatus = syncService.getSyncStatus();
      testResults.tests.syncStateManager = {
        success: true,
        data: syncStatus,
        message: 'Sync state manager working'
      };
    } catch (error) {
      testResults.tests.syncStateManager = {
        success: false,
        error: error.message,
        message: 'Sync state manager test failed'
      };
    }

    // Test 3: Scheduler Status
    try {
      const schedulerStatus = syncScheduler.getStatus();
      testResults.tests.schedulerStatus = {
        success: schedulerStatus.isRunning,
        data: schedulerStatus,
        message: schedulerStatus.isRunning ? 'Scheduler running' : 'Scheduler not running'
      };
    } catch (error) {
      testResults.tests.schedulerStatus = {
        success: false,
        error: error.message,
        message: 'Scheduler status test failed'
      };
    }

    // Test 4: Mock Sync Data (without actual data)
    try {
      const mockCandidateData = {
        hallTicket: 'TEST_' + Date.now(),
        id: 'TEST_CANDIDATE',
        candidateName: 'Test Candidate',
        emailId: 'test@example.com',
        phone: '1234567890',
        gender: 'other',
        centreCode: 'TEST001',
        centreName: 'Test Centre',
        examSlot: 'MORNING',
        examId: 'TEST_EXAM',
        userExamApplicationId: 'TEST_APP',
        timestamp: new Date().toISOString(),
        faceData: null, // Don't send actual data in test
        thumbData: null,
        ISOTemplateBase64: null,
        TemplateBase64: null
      };

      // Test sync data preparation (without actually sending)
      const syncId = syncService.generateSyncId(mockCandidateData.hallTicket, 'face');
      testResults.tests.syncDataPreparation = {
        success: true,
        data: {
          syncId,
          hallTicket: mockCandidateData.hallTicket,
          biometricType: 'face'
        },
        message: 'Sync data preparation working'
      };
    } catch (error) {
      testResults.tests.syncDataPreparation = {
        success: false,
        error: error.message,
        message: 'Sync data preparation failed'
      };
    }

    // Test 5: File System Operations
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Test data directory creation
      const dataDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      testResults.tests.fileSystem = {
        success: true,
        data: { dataDir: dataDir },
        message: 'File system operations working'
      };
    } catch (error) {
      testResults.tests.fileSystem = {
        success: false,
        error: error.message,
        message: 'File system test failed'
      };
    }

    // Calculate overall success
    const totalTests = Object.keys(testResults.tests).length;
    const successfulTests = Object.values(testResults.tests).filter(test => test.success).length;
    const overallSuccess = successfulTests === totalTests;

    testResults.summary = {
      totalTests,
      successfulTests,
      failedTests: totalTests - successfulTests,
      overallSuccess,
      successRate: Math.round((successfulTests / totalTests) * 100)
    };

    logger.info('Sync test completed', testResults.summary);

    res.json({
      successful: true,
      message: `Sync test completed: ${successfulTests}/${totalTests} tests passed`,
      data: testResults
    });

  } catch (error) {
    logger.error('Error running sync test:', error);
    res.status(500).json({
      successful: false,
      error: 'Failed to run sync test',
      message: error.message
    });
  }
});

// GET /api/sync/test-summary - Get quick test summary
router.get('/test-summary', async (req, res) => {
  try {
    const quickTest = {
      timestamp: new Date().toISOString(),
      localBackend: {
        status: 'running',
        port: process.env.PORT || 8080,
        environment: process.env.NODE_ENV || 'development'
      },
      cloudConnection: await syncService.testCloudConnection(),
      scheduler: syncScheduler.getStatus(),
      syncState: syncService.getSyncStatus()
    };

    res.json({
      successful: true,
      message: 'Quick test summary',
      data: quickTest
    });

  } catch (error) {
    logger.error('Error getting test summary:', error);
    res.status(500).json({
      successful: false,
      error: 'Failed to get test summary'
    });
  }
});

module.exports = router;
