const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

class SyncStateManager {
  constructor() {
    this.syncStatePath = path.join(__dirname, '../../data/sync-state.json');
    this.localBackendId = process.env.LOCAL_BACKEND_ID || 'local-biometric-center-1';
    this.syncState = this.loadSyncState();
  }

  // Load sync state from file
  loadSyncState() {
    try {
      if (fs.existsSync(this.syncStatePath)) {
        const data = fs.readFileSync(this.syncStatePath, 'utf8');
        return JSON.parse(data);
      } else {
        // Initialize new sync state
        return this.initializeSyncState();
      }
    } catch (error) {
      logger.error('Error loading sync state:', error);
      return this.initializeSyncState();
    }
  }

  // Initialize new sync state structure
  initializeSyncState() {
    const initialState = {
      localBackendId: this.localBackendId,
      lastSyncTimestamp: null,
      syncStatus: {},
      pendingSync: [],
      failedSync: [],
      totalSynced: 0,
      totalFailed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.saveSyncState(initialState);
    return initialState;
  }

  // Save sync state to file
  saveSyncState(state = null) {
    try {
      const stateToSave = state || this.syncState;
      stateToSave.updatedAt = new Date().toISOString();
      
      // Ensure data directory exists
      const dataDir = path.dirname(this.syncStatePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(this.syncStatePath, JSON.stringify(stateToSave, null, 2));
      
      if (state) {
        this.syncState = state;
      }
      
      logger.debug('Sync state saved', {
        localBackendId: this.localBackendId,
        totalSynced: stateToSave.totalSynced,
        totalFailed: stateToSave.totalFailed,
        pendingCount: stateToSave.pendingSync.length
      });
    } catch (error) {
      logger.error('Error saving sync state:', error);
    }
  }

  // Update sync status for a specific candidate and biometric type
  updateSyncStatus(hallTicket, biometricType, updateData) {
    const syncId = updateData.syncId || `sync_${Date.now()}_${hallTicket}_${biometricType}`;
    
    // Initialize candidate sync status if not exists
    if (!this.syncState.syncStatus[hallTicket]) {
      this.syncState.syncStatus[hallTicket] = {};
    }
    
    // Update biometric type status
    this.syncState.syncStatus[hallTicket][biometricType] = {
      syncId,
      hallTicket,
      biometricType,
      localPath: updateData.localPath || null,
      synced: updateData.synced || false,
      cloudId: updateData.cloudId || null,
      syncedAt: updateData.syncedAt || null,
      error: updateData.error || null,
      lastAttempt: updateData.lastAttempt || new Date().toISOString(),
      retryCount: updateData.retryCount || 0,
      createdAt: updateData.createdAt || new Date().toISOString()
    };
    
    // Update pending/failed lists
    this.updateSyncLists();
    
    // Save state
    this.saveSyncState();
    
    logger.info('Sync status updated', {
      hallTicket,
      biometricType,
      synced: updateData.synced,
      error: updateData.error,
      retryCount: updateData.retryCount
    });
    
    return this.syncState.syncStatus[hallTicket][biometricType];
  }

  // Update pending and failed sync lists
  updateSyncLists() {
    const pending = [];
    const failed = [];
    
    Object.entries(this.syncState.syncStatus).forEach(([hallTicket, biometrics]) => {
      Object.entries(biometrics).forEach(([biometricType, status]) => {
        if (!status.synced) {
          if (status.error && status.retryCount >= 3) {
            failed.push({
              hallTicket,
              biometricType,
              error: status.error,
              retryCount: status.retryCount,
              lastAttempt: status.lastAttempt
            });
          } else {
            pending.push({
              hallTicket,
              biometricType,
              retryCount: status.retryCount,
              lastAttempt: status.lastAttempt
            });
          }
        }
      });
    });
    
    this.syncState.pendingSync = pending;
    this.syncState.failedSync = failed;
    
    // Update totals
    let totalSynced = 0;
    let totalFailed = 0;
    
    Object.values(this.syncState.syncStatus).forEach(biometrics => {
      Object.values(biometrics).forEach(status => {
        if (status.synced) {
          totalSynced++;
        } else if (status.retryCount >= 3) {
          totalFailed++;
        }
      });
    });
    
    this.syncState.totalSynced = totalSynced;
    this.syncState.totalFailed = totalFailed;
  }

  // Get candidates pending sync
  getPendingSync() {
    return this.syncState.pendingSync;
  }

  // Get failed sync items
  getFailedSync() {
    return this.syncState.failedSync;
  }

  // Get sync status for specific candidate
  getCandidateSyncStatus(hallTicket) {
    return this.syncState.syncStatus[hallTicket] || null;
  }

  // Get overall sync status
  getSyncStatus() {
    return {
      localBackendId: this.syncState.localBackendId,
      lastSyncTimestamp: this.syncState.lastSyncTimestamp,
      totalCandidates: Object.keys(this.syncState.syncStatus).length,
      syncedCount: this.syncState.totalSynced,
      failedCount: this.syncState.totalFailed,
      pendingCount: this.syncState.pendingSync.length,
      createdAt: this.syncState.createdAt,
      updatedAt: this.syncState.updatedAt
    };
  }

  // Mark item as synced
  markAsSynced(hallTicket, biometricType, cloudId) {
    return this.updateSyncStatus(hallTicket, biometricType, {
      synced: true,
      cloudId,
      syncedAt: new Date().toISOString(),
      error: null
    });
  }

  // Mark item as failed
  markAsFailed(hallTicket, biometricType, error) {
    const currentStatus = this.syncState.syncStatus[hallTicket]?.[biometricType];
    const retryCount = (currentStatus?.retryCount || 0) + 1;
    
    return this.updateSyncStatus(hallTicket, biometricType, {
      synced: false,
      error,
      retryCount,
      lastAttempt: new Date().toISOString()
    });
  }

  // Reset retry count for retry mechanism
  resetRetryCount(hallTicket, biometricType) {
    return this.updateSyncStatus(hallTicket, biometricType, {
      retryCount: 0,
      error: null,
      lastAttempt: new Date().toISOString()
    });
  }

  // Update last sync timestamp
  updateLastSyncTimestamp() {
    this.syncState.lastSyncTimestamp = new Date().toISOString();
    this.saveSyncState();
  }

  // Get sync statistics
  getSyncStatistics() {
    const stats = {
      byBiometricType: {
        face: { synced: 0, failed: 0, pending: 0 },
        thumb: { synced: 0, failed: 0, pending: 0 }
      },
      byHour: {},
      recentActivity: []
    };
    
    Object.entries(this.syncState.syncStatus).forEach(([hallTicket, biometrics]) => {
      Object.entries(biometrics).forEach(([biometricType, status]) => {
        // Update biometric type stats
        if (status.synced) {
          stats.byBiometricType[biometricType].synced++;
        } else if (status.retryCount >= 3) {
          stats.byBiometricType[biometricType].failed++;
        } else {
          stats.byBiometricType[biometricType].pending++;
        }
        
        // Update hourly stats
        const hour = new Date(status.createdAt).getHours();
        stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
        
        // Recent activity (last 24 hours)
        const createdAt = new Date(status.createdAt);
        const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursAgo <= 24) {
          stats.recentActivity.push({
            hallTicket,
            biometricType,
            synced: status.synced,
            createdAt: status.createdAt
          });
        }
      });
    });
    
    // Sort recent activity by most recent
    stats.recentActivity.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    return stats;
  }
}

module.exports = SyncStateManager;
