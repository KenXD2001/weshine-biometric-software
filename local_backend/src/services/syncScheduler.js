const logger = require('../config/logger');
const SyncService = require('./syncService');

class SyncScheduler {
  constructor() {
    this.syncService = new SyncService();
    this.isRunning = false;
    this.syncInterval = null;
    this.retryInterval = null;
    this.connectionCheckInterval = null;
    this.wasConnected = true; // Track previous connection state
    
    // Configuration
    this.syncIntervalMs = parseInt(process.env.SYNC_INTERVAL_MS) || 300000; // 5 minutes
    this.retryIntervalMs = parseInt(process.env.RETRY_INTERVAL_MS) || 60000; // 1 minute
    this.connectionCheckMs = parseInt(process.env.CONNECTION_CHECK_MS) || 30000; // 30 seconds
  }

  // Start all background sync processes
  start() {
    if (this.isRunning) {
      logger.warn('Sync scheduler already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting sync scheduler', {
      syncInterval: this.syncIntervalMs,
      retryInterval: this.retryIntervalMs,
      connectionCheck: this.connectionCheckMs
    });

    // Start periodic sync of pending items
    this.startPeriodicSync();
    
    // Start retry mechanism for failed items
    this.startRetryMechanism();
    
    // Start connection health checks
    this.startConnectionChecks();

    logger.success('Sync scheduler started successfully');
  }

  // Stop all background sync processes
  stop() {
    if (!this.isRunning) {
      logger.warn('Sync scheduler not running');
      return;
    }

    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }

    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    logger.info('Sync scheduler stopped');
  }

  // Start periodic sync of pending items
  startPeriodicSync() {
    this.syncInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        // logger.debug('Running periodic sync check');
        const results = await this.syncService.syncAllPending();
        
        if (results.length > 0) {
          const successful = results.filter(r => r.result.success).length;
          const failed = results.filter(r => !r.result.success).length;
          
          logger.info('Periodic sync completed', {
            totalProcessed: results.length,
            successful,
            failed
          });
        }
      } catch (error) {
        logger.error('Periodic sync error:', error);
      }
    }, this.syncIntervalMs);

    // logger.debug('Periodic sync scheduled', { interval: this.syncIntervalMs });
  }

  // Start retry mechanism for failed items
  startRetryMechanism() {
    this.retryInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        // logger.debug('Running retry mechanism');
        const results = await this.syncService.retryFailedSyncs();
        
        if (results.retried > 0) {
          logger.info('Retry mechanism completed', results);
        }
      } catch (error) {
        logger.error('Retry mechanism error:', error);
      }
    }, this.retryIntervalMs);

    // logger.debug('Retry mechanism scheduled', { interval: this.retryIntervalMs });
  }

  // Start connection health checks
  startConnectionChecks() {
    this.connectionCheckInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const connectionStatus = await this.syncService.testCloudConnection();
        
        if (!connectionStatus.connected) {
          this.wasConnected = false;
          logger.warn('Cloud connection lost', {
            error: connectionStatus.error,
            timestamp: connectionStatus.timestamp
          });
        } else {
          // Trigger sync on connection recovery
          if (!this.wasConnected) {
            this.wasConnected = true;
            logger.info('Cloud connection restored, triggering immediate sync', {
              responseTime: connectionStatus.responseTime,
              timestamp: connectionStatus.timestamp
            });
            
            // Trigger immediate sync for pending items
            this.triggerRecoverySync();
          }
        }
      } catch (error) {
        this.wasConnected = false;
        logger.error('Connection check error:', error);
      }
    }, this.connectionCheckMs);

    // logger.debug('Connection checks scheduled', { interval: this.connectionCheckMs });
  }

  // Trigger sync on connection recovery
  async triggerRecoverySync() {
    try {
      // Get pending items count
      const pendingItems = this.syncService.syncStateManager.getPendingSync();
      
      if (pendingItems.length === 0) {
        // logger.debug('No pending items to sync on recovery');
        return;
      }
      
      logger.info('Starting recovery sync for pending items', {
        pendingCount: pendingItems.length
      });
      
      // Check if sync is already in progress to avoid conflicts
      if (this.syncService.syncInProgress) {
        // logger.debug('Sync already in progress, recovery sync will be handled by existing process');
        return;
      }
      
      // Sync pending items immediately
      const results = await this.syncService.syncAllPending();
      
      if (results.length > 0) {
        const successful = results.filter(r => r.result.success).length;
        const failed = results.filter(r => !r.result.success).length;
        
        logger.info('Recovery sync completed', {
          totalProcessed: results.length,
          successful,
          failed
        });
      }
    } catch (error) {
      logger.error('Recovery sync error:', {
        message: error.message || 'Unknown error',
        stack: error.stack,
        error: error
      });
    }
  }

  // Manual trigger for immediate sync
  async triggerImmediateSync() {
    if (!this.isRunning) {
      logger.warn('Sync scheduler not running, cannot trigger immediate sync');
      return { success: false, error: 'Scheduler not running' };
    }

    try {
      logger.info('Manual immediate sync triggered');
      
      // First sync pending items
      const pendingResults = await this.syncService.syncAllPending();
      
      // Then retry failed items
      const retryResults = await this.syncService.retryFailedSyncs();
      
      const results = {
        pending: {
          totalProcessed: pendingResults.length,
          successful: pendingResults.filter(r => r.result.success).length,
          failed: pendingResults.filter(r => !r.result.success).length
        },
        retry: retryResults
      };

      logger.success('Immediate sync completed', results);
      return { success: true, data: results };
      
    } catch (error) {
      logger.error('Immediate sync error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      configuration: {
        syncIntervalMs: this.syncIntervalMs,
        retryIntervalMs: this.retryIntervalMs,
        connectionCheckMs: this.connectionCheckMs
      },
      intervals: {
        syncInterval: !!this.syncInterval,
        retryInterval: !!this.retryInterval,
        connectionCheckInterval: !!this.connectionCheckInterval
      },
      cloudBackendUrl: this.syncService.cloudBackendUrl,
      localBackendId: this.syncService.syncStateManager.localBackendId
    };
  }

  // Update configuration
  updateConfiguration(newConfig) {
    const oldConfig = {
      syncIntervalMs: this.syncIntervalMs,
      retryIntervalMs: this.retryIntervalMs,
      connectionCheckMs: this.connectionCheckMs
    };

    // Update configuration
    if (newConfig.syncIntervalMs) {
      this.syncIntervalMs = newConfig.syncIntervalMs;
    }
    if (newConfig.retryIntervalMs) {
      this.retryIntervalMs = newConfig.retryIntervalMs;
    }
    if (newConfig.connectionCheckMs) {
      this.connectionCheckMs = newConfig.connectionCheckMs;
    }

    // Restart scheduler with new configuration if running
    if (this.isRunning) {
      logger.info('Restarting scheduler with new configuration', { oldConfig, newConfig });
      this.stop();
      this.start();
    } else {
      logger.info('Configuration updated (scheduler not running)', { oldConfig, newConfig });
    }
  }

  // Get sync statistics
  getStatistics() {
    return this.syncService.getSyncStatistics();
  }

  // Get sync status
  getSyncStatus() {
    return this.syncService.getSyncStatus();
  }
}

module.exports = SyncScheduler;
