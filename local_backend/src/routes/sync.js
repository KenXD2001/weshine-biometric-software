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

module.exports = router;
