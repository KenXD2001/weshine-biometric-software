const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const SyncService = require('../services/syncService');
const SyncScheduler = require('../services/syncScheduler');
const logger = require('../config/logger');
const candidatesModule = require('./candidates');

const syncService = new SyncService();
const syncScheduler = new SyncScheduler();

const sanitizeFolderName = (name) => {
  if (!name || typeof name !== 'string') return 'unknown';
  return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '_').replace(/-+/g, '-').trim();
};

const downloadCloudImage = async (url, hallTicket, imageType) => {
  const requestId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  if (!url || !hallTicket || !imageType) {
    logger.warn('Invalid parameters for image download', {
      requestId,
      url: !!url,
      hallTicket: !!hallTicket,
      imageType: !!imageType,
      reason: 'Missing required parameters'
    });
    return null;
  }

  const sanitizedHallTicket = sanitizeFolderName(hallTicket);
  const filename = `${imageType}_${Date.now()}.png`;
  const candidateDir = path.join(__dirname, '../../data/candidates-data', sanitizedHallTicket);

  try {
    logger.info('Starting cloud image download', {
      requestId,
      hallTicket,
      imageType,
      url,
      filename,
      candidateDir,
      timestamp: new Date().toISOString()
    });

    if (!fs.existsSync(candidateDir)) {
      fs.mkdirSync(candidateDir, { recursive: true });
      logger.debug('Created candidate directory', {
        requestId,
        candidateDir
      });
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20000
    });

    const filePath = path.join(candidateDir, filename);
    fs.writeFileSync(filePath, response.data);

    const processingTime = Date.now() - startTime;
    const fileSize = response.data.length;

    logger.info('Cloud image downloaded successfully', {
      requestId,
      hallTicket,
      imageType,
      url,
      filePath,
      fileSize,
      fileSizeKB: (fileSize / 1024).toFixed(2),
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });

    return `/data/candidates-data/${sanitizedHallTicket}/${filename}`;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Failed to download cloud image', {
      requestId,
      hallTicket,
      imageType,
      url,
      error: error.message,
      errorCode: error.response?.status || 'NO_CODE',
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });

    return url; // Return original URL as fallback
  }
};

const getTimestampValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

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

// POST /api/sync/trigger-immediate - Trigger immediate cloud-to-local biometric sync
router.post('/trigger-immediate', async (req, res) => {
  const requestId = `sync_immediate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    logger.info('Immediate cloud-to-local biometric sync triggered', {
      requestId,
      clientIP: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    if (!syncScheduler.isRunning) {
      logger.warn('Sync scheduler is not running; starting scheduler before immediate sync', {
        requestId
      });
      syncScheduler.start();
      logger.info('Sync scheduler started', {
        requestId
      });
    }

    const candidates = candidatesModule.getCandidates();
    const candidateLookupKeys = candidates
      .map((candidate) => candidate.id || candidate.hallTicket)
      .filter(Boolean);

    logger.info('Fetching candidate biometric records from cloud', {
      requestId,
      totalLocalCandidates: candidates.length,
      validLookupKeys: candidateLookupKeys.length,
      lookupKeys: candidateLookupKeys.slice(0, 10), // Log first 10 for brevity
      timestamp: new Date().toISOString()
    });

    const cloudResponse = await syncService.fetchCloudBiometricRecords(candidateLookupKeys);
    const records = Array.isArray(cloudResponse.records) ? cloudResponse.records : [];

    logger.info('Cloud response received', {
      requestId,
      totalRequested: cloudResponse.totalRequested || candidateLookupKeys.length,
      totalFound: cloudResponse.foundCount || 0,
      faceCount: cloudResponse.faceCount || 0,
      thumbCount: cloudResponse.thumbCount || 0,
      templateCount: cloudResponse.templateCount || 0,
      cloudProcessingTime: cloudResponse.processingTime || 'N/A',
      timestamp: new Date().toISOString()
    });

    const candidateMap = new Map();
    candidates.forEach((candidate) => {
      if (candidate.id) {
        candidateMap.set(String(candidate.id), candidate);
      }
      if (candidate.hallTicket) {
        candidateMap.set(String(candidate.hallTicket), candidate);
      }
    });

    const summary = {
      totalLocalCandidates: candidateLookupKeys.length,
      totalCloudCandidates: records.filter(record => record.hasBiometric).length,
      totalMissingInCloud: 0,
      totalSynced: 0,
      totalUpdated: 0,
      totalAlreadyLocal: 0,
      totalFailed: 0,
      details: []
    };

    let savedAny = false;
    let totalDownloadedImages = 0;
    let totalDownloadSize = 0;

    for (const record of records) {
      const candidate = candidateMap.get(String(record.hallTicket));
      const detail = {
        hallTicket: record.hallTicket,
        hasBiometricInCloud: record.hasBiometric,
        synced: false,
        updated: false,
        alreadyLocal: false,
        failed: false,
        notes: [],
        downloadedImages: []
      };

      if (!candidate) {
        detail.notes.push('Local candidate not found');
        detail.failed = true;
        summary.totalFailed++;
        logger.warn('Local candidate not found for cloud record', {
          requestId,
          hallTicket: record.hallTicket
        });
        summary.details.push(detail);
        continue;
      }

      const beforeStatus = {
        face: candidate.faceStatus,
        thumb: candidate.thumbStatus,
        biometricStatus: candidate.biometricStatus
      };

      logger.debug('Processing candidate biometric sync', {
        requestId,
        hallTicket: record.hallTicket,
        hasFace: !!record.face,
        hasThumb: !!record.thumb,
        hasTemplate: !!record.additionalDetails,
        beforeStatus
      });

      let changed = false;
      let hasAnyLocal = candidate.faceStatus === 'Completed' || candidate.thumbStatus === 'Completed';
      const localFaceTimestamp = getTimestampValue(candidate.imageCaptureTimestamp);
      const localThumbTimestamp = getTimestampValue(candidate.thumbCaptureTimestamp);

      // Process face biometric
      if (record.face) {
        const cloudFaceTimestamp = getTimestampValue(record.face.captured_at || record.face.updated_at || record.face.created_at);
        const shouldUpdateFace = !candidate.faceStatus || candidate.faceStatus !== 'Completed' || (cloudFaceTimestamp && localFaceTimestamp && cloudFaceTimestamp > localFaceTimestamp);

        if (shouldUpdateFace) {
          logger.debug('Syncing face biometric from cloud', {
            requestId,
            hallTicket: record.hallTicket,
            cloudTimestamp: cloudFaceTimestamp?.toISOString(),
            localTimestamp: localFaceTimestamp?.toISOString(),
            reason: !candidate.faceStatus ? 'No local face' : (cloudFaceTimestamp > localFaceTimestamp ? 'Cloud is newer' : 'Local update needed')
          });

          const localPath = record.face.imageUrl && !record.face.imageUrl.startsWith('local:')
            ? await downloadCloudImage(record.face.imageUrl, record.hallTicket, 'face')
            : record.face.imageUrl;

          if (localPath && localPath !== record.face.imageUrl) {
            totalDownloadedImages++;
            detail.downloadedImages.push({ type: 'face', path: localPath });
            
            // Get file size for stats
            try {
              const fullPath = path.join(__dirname, '../..', localPath);
              if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                totalDownloadSize += stats.size;
              }
            } catch (sizeError) {
              logger.debug('Could not get downloaded file size', {
                requestId,
                hallTicket: record.hallTicket,
                localPath,
                error: sizeError.message
              });
            }
          }

          candidate.faceStatus = 'Completed';
          candidate.capturedImagePath = localPath || candidate.capturedImagePath;
          candidate.imageCaptureTimestamp = cloudFaceTimestamp ? cloudFaceTimestamp.toISOString() : candidate.imageCaptureTimestamp || new Date().toISOString();
          candidate.cloudFaceId = record.face.id;
          candidate.faceCloudPath = record.face.imageUrl;
          changed = true;
          detail.notes.push('Face biometric synced/updated from cloud');
          
          logger.info('Face biometric synced successfully', {
            requestId,
            hallTicket: record.hallTicket,
            localPath,
            cloudId: record.face.id
          });
        } else {
          detail.notes.push('Face biometric already newer locally');
        }
      }

      // Process thumb biometric
      if (record.thumb) {
        const cloudThumbTimestamp = getTimestampValue(record.thumb.captured_at || record.thumb.updated_at || record.thumb.created_at);
        const shouldUpdateThumb = !candidate.thumbStatus || candidate.thumbStatus !== 'Completed' || (cloudThumbTimestamp && localThumbTimestamp && cloudThumbTimestamp > localThumbTimestamp);

        if (shouldUpdateThumb) {
          logger.debug('Syncing thumb biometric from cloud', {
            requestId,
            hallTicket: record.hallTicket,
            cloudTimestamp: cloudThumbTimestamp?.toISOString(),
            localTimestamp: localThumbTimestamp?.toISOString(),
            reason: !candidate.thumbStatus ? 'No local thumb' : (cloudThumbTimestamp > localThumbTimestamp ? 'Cloud is newer' : 'Local update needed')
          });

          const localPath = record.thumb.imageUrl && !record.thumb.imageUrl.startsWith('local:')
            ? await downloadCloudImage(record.thumb.imageUrl, record.hallTicket, 'thumb')
            : record.thumb.imageUrl;

          if (localPath && localPath !== record.thumb.imageUrl) {
            totalDownloadedImages++;
            detail.downloadedImages.push({ type: 'thumb', path: localPath });
            
            // Get file size for stats
            try {
              const fullPath = path.join(__dirname, '../..', localPath);
              if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                totalDownloadSize += stats.size;
              }
            } catch (sizeError) {
              logger.debug('Could not get downloaded file size', {
                requestId,
                hallTicket: record.hallTicket,
                localPath,
                error: sizeError.message
              });
            }
          }

          candidate.thumbStatus = 'Completed';
          candidate.biometricImagePath = localPath || candidate.biometricImagePath;
          candidate.thumbCaptureTimestamp = cloudThumbTimestamp ? cloudThumbTimestamp.toISOString() : candidate.thumbCaptureTimestamp || new Date().toISOString();
          candidate.cloudThumbId = record.thumb.id;
          candidate.thumbCloudPath = record.thumb.imageUrl;
          changed = true;
          detail.notes.push('Thumb biometric synced/updated from cloud');
          
          logger.info('Thumb biometric synced successfully', {
            requestId,
            hallTicket: record.hallTicket,
            localPath,
            cloudId: record.thumb.id
          });
        } else {
          detail.notes.push('Thumb biometric already newer locally');
        }
      }

      // Process template data
      if (record.additionalDetails) {
        let templateChanged = false;
        if (record.additionalDetails.ISOTemplateBase64 && record.additionalDetails.ISOTemplateBase64 !== candidate.ISOTemplateBase64) {
          candidate.ISOTemplateBase64 = record.additionalDetails.ISOTemplateBase64;
          changed = true;
          templateChanged = true;
          detail.notes.push('ISO template updated');
        }
        if (record.additionalDetails.TemplateBase64 && record.additionalDetails.TemplateBase64 !== candidate.TemplateBase64) {
          candidate.TemplateBase64 = record.additionalDetails.TemplateBase64;
          changed = true;
          templateChanged = true;
          detail.notes.push('TemplateBase64 updated');
        }
        
        if (templateChanged) {
          logger.info('Template data synced successfully', {
            requestId,
            hallTicket: record.hallTicket,
            hasISO: !!record.additionalDetails.ISOTemplateBase64,
            hasTemplate: !!record.additionalDetails.TemplateBase64
          });
        }
      }

      // Update biometric status
      const faceComplete = candidate.faceStatus === 'Completed';
      const thumbComplete = candidate.thumbStatus === 'Completed';
      candidate.biometricStatus = faceComplete && thumbComplete ? 'Completed' : (faceComplete || thumbComplete ? 'Partial' : candidate.biometricStatus || 'Pending');

      if (changed) {
        savedAny = true;
        summary.totalSynced += hasAnyLocal ? 0 : 1;
        summary.totalUpdated += hasAnyLocal ? 1 : 0;
        detail.synced = true;
        detail.updated = hasAnyLocal;
        
        logger.info('Candidate biometric data updated', {
          requestId,
          hallTicket: record.hallTicket,
          beforeStatus,
          afterStatus: {
            face: candidate.faceStatus,
            thumb: candidate.thumbStatus,
            biometricStatus: candidate.biometricStatus
          },
          downloadedImages: detail.downloadedImages.length
        });
      } else if (hasAnyLocal) {
        summary.totalAlreadyLocal += 1;
        detail.alreadyLocal = true;
      }

      if (!record.hasBiometric) {
        summary.totalMissingInCloud += 1;
        detail.notes.push('No biometric data found on cloud');
      }

      summary.details.push(detail);
    }

    // Save to disk if any changes were made
    if (savedAny) {
      logger.info('Saving updated candidate data to disk', {
        requestId,
        totalCandidates: candidates.length,
        timestamp: new Date().toISOString()
      });
      
      await candidatesModule.saveToDisk();
      
      logger.info('Candidate data saved successfully', {
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    const processingTime = Date.now() - startTime;

    logger.info('Immediate cloud-to-local biometric sync completed', {
      requestId,
      summary: {
        totalLocalCandidates: summary.totalLocalCandidates,
        totalCloudCandidates: summary.totalCloudCandidates,
        totalSynced: summary.totalSynced,
        totalUpdated: summary.totalUpdated,
        totalAlreadyLocal: summary.totalAlreadyLocal,
        totalMissingInCloud: summary.totalMissingInCloud,
        totalFailed: summary.totalFailed,
        totalDownloadedImages,
        totalDownloadSizeKB: (totalDownloadSize / 1024).toFixed(2),
        savedAny,
        processingTime: `${processingTime}ms`
      },
      timestamp: new Date().toISOString()
    });

    res.json({
      successful: true,
      message: 'Cloud-to-local biometric sync completed',
      data: {
        ...summary,
        totalDownloadedImages,
        totalDownloadSizeKB: (totalDownloadSize / 1024).toFixed(2),
        processingTime: `${processingTime}ms`,
        cloudProcessingTime: cloudResponse.processingTime || 'N/A'
      }
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Error in immediate cloud-to-local sync', {
      requestId,
      error: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      successful: false,
      error: 'Failed to trigger immediate sync',
      details: error.message,
      processingTime: `${processingTime}ms`
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
