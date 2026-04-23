const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const SyncStateManager = require('./syncStateManager');

class SyncService {
  constructor() {
    this.cloudBackendUrl = process.env.CLOUD_BACKEND_URL || 'http://localhost:8040';
    this.syncStateManager = new SyncStateManager();
    this.syncInProgress = false;
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second base delay
  }

  // Generate unique sync ID
  generateSyncId(hallTicket, biometricType) {
    return `sync_${Date.now()}_${hallTicket}_${biometricType}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Convert base64 to image file for sync
  prepareImageFile(base64Data, imageType, hallTicket) {
    try {
      if (!base64Data) return null;

      // Remove data URI prefix if present
      const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64String, 'base64');

      // Create temp directory
      const tempDir = path.join(__dirname, '../../.temp-sync');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Save as PNG file
      const fileName = `${imageType}_${hallTicket}_${Date.now()}.png`;
      const filePath = path.join(tempDir, fileName);
      
      fs.writeFileSync(filePath, buffer);

      logger.debug('Image file prepared for sync', {
        imageType,
        hallTicket,
        fileName,
        sizeBytes: buffer.length
      });

      return filePath;
    } catch (error) {
      logger.error('Error preparing image file for sync', {
        imageType,
        hallTicket,
        error: error.message
      });
      return null;
    }
  }

  // Sync biometric data to cloud with confirmation
  async syncBiometricData(candidateData, biometricType) {
    const syncId = this.generateSyncId(candidateData.hallTicket, biometricType);
    const startTime = Date.now();
    let imageFilePath = null; // Declare at function scope
    
    try {
      logger.info('Starting biometric sync', {
        syncId,
        hallTicket: candidateData.hallTicket,
        biometricType,
        localBackendId: this.syncStateManager.localBackendId
      });

      // Update sync state to "in progress"
      this.syncStateManager.updateSyncStatus(candidateData.hallTicket, biometricType, {
        syncId,
        synced: false,
        lastAttempt: new Date().toISOString(),
        retryCount: 0
      });

      // Prepare image file - use existing saved image path first
      let imageFilePath = null;
      if (candidateData.localImagePath) {
        if (fs.existsSync(candidateData.localImagePath)) {
          imageFilePath = candidateData.localImagePath;
        } else {
          const cleanedPath = candidateData.localImagePath.replace(/^\/+/, '');
          const resolvedDataPath = path.join(__dirname, '../../', cleanedPath);
          if (fs.existsSync(resolvedDataPath)) {
            imageFilePath = resolvedDataPath;
          }
        }

        if (imageFilePath) {
          logger.debug('Using existing image file', {
            hallTicket: candidateData.hallTicket,
            biometricType,
            imagePath: imageFilePath
          });
        } else {
          logger.debug('Existing local image path not found, falling back to base64', {
            hallTicket: candidateData.hallTicket,
            biometricType,
            attemptedPath: candidateData.localImagePath
          });
        }
      }

      if (!imageFilePath && candidateData.faceData && biometricType === 'face') {
        // Fallback: create image from base64 data
        imageFilePath = this.prepareImageFile(candidateData.faceData, 'face', candidateData.hallTicket);
        logger.debug('Created image file from base64', {
          hallTicket: candidateData.hallTicket,
          biometricType,
          imagePath: imageFilePath
        });
      } else if (candidateData.thumbData && biometricType === 'thumb') {
        // Fallback: create image from base64 data
        imageFilePath = this.prepareImageFile(candidateData.thumbData, 'thumb', candidateData.hallTicket);
        logger.debug('Created image file from base64', {
          hallTicket: candidateData.hallTicket,
          biometricType,
          imagePath: imageFilePath
        });
      } else {
        logger.warn('No image data available for sync', {
          hallTicket: candidateData.hallTicket,
          biometricType,
          hasLocalPath: !!candidateData.localImagePath,
          hasFaceData: !!candidateData.faceData,
          hasThumbData: !!candidateData.thumbData
        });
      }

      // Prepare FormData for multipart upload
      const formData = new FormData();
      
      // Add metadata
      const metadata = {
        syncId,
        localBackendId: this.syncStateManager.localBackendId,
        hallTicket: candidateData.hallTicket,
        candidateId: candidateData.id || candidateData.hallTicket,
        candidateName: candidateData.candidateName,
        emailId: candidateData.emailId,
        phone: candidateData.phone || '',
        gender: candidateData.gender || 'other',
        biometricType,
        captureType: biometricType,
        centreCode: candidateData.centreCode || '',
        centreName: candidateData.centreName || '',
        examSlot: candidateData.examSlot || '',
        examId: candidateData.examId || '',
        userExamApplicationId: candidateData.userExamApplicationId || '',
        timestamp: candidateData.timestamp || new Date().toISOString(),
        // Template data for fingerprint
        ISOTemplateBase64: candidateData.ISOTemplateBase64 || null,
        TemplateBase64: candidateData.TemplateBase64 || null
      };
      
      formData.append('metadata', JSON.stringify(metadata));

      // Add image file if available
      if (imageFilePath && fs.existsSync(imageFilePath)) {
        formData.append('biometricImage', fs.createReadStream(imageFilePath));
      }

      // Send to cloud backend
      const response = await axios.post(
        `${this.cloudBackendUrl}/api/sync/biometric`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 30000, // 30 seconds
          validateStatus: (status) => status < 500 // Don't retry for 5xx errors
        }
      );

      const processingTime = Date.now() - startTime;

      if (response.data && response.data.success) {
        // Validate cloudId before marking as synced
        if (!response.data.cloudId) {
          throw new Error('Cloud sync returned success but no cloudId provided');
        }
        
        // Success - update sync state
        this.syncStateManager.markAsSynced(candidateData.hallTicket, biometricType, response.data.cloudId);
        this.syncStateManager.updateLastSyncTimestamp();

        logger.success('Biometric sync completed', {
          syncId,
          hallTicket: candidateData.hallTicket,
          biometricType,
          cloudId: response.data.cloudId,
          processingTime,
          s3Urls: response.data.s3Urls
        });

        return {
          success: true,
          syncId,
          cloudId: response.data.cloudId,
          s3Urls: response.data.s3Urls,
          processingTime
        };
      } else {
        throw new Error(response.data?.error || 'Cloud sync failed');
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error.response?.data?.error || error.message;
      
      // Update sync state with error
      this.syncStateManager.markAsFailed(candidateData.hallTicket, biometricType, errorMessage);

      logger.error('Biometric sync failed', {
        syncId,
        hallTicket: candidateData.hallTicket,
        biometricType,
        error: errorMessage,
        processingTime,
        retryCount: 0
      });

      return {
        success: false,
        syncId,
        error: errorMessage,
        processingTime
      };
    } finally {
      // Cleanup temp file
      if (imageFilePath && fs.existsSync(imageFilePath)) {
        try {
          fs.unlinkSync(imageFilePath);
          logger.debug('Temp sync file cleaned up', { filePath: imageFilePath });
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp file', { 
            filePath: imageFilePath, 
            error: cleanupError.message 
          });
        }
      }
    }
  }

  // Retry failed sync items with exponential backoff
  async retryFailedSyncs() {
    if (this.syncInProgress) {
      logger.warn('Sync already in progress, skipping retry');
      return;
    }

    this.syncInProgress = true;
    // Use pending items for retries so we attempt items that failed due to transient errors
    const pendingItems = this.syncStateManager.getPendingSync();
    if (pendingItems.length === 0) {
      this.syncInProgress = false;
      // No logs for idling cycles
      return {
        retried: 0,
        successful: 0,
        failed: 0,
        errors: []
      };
    }

    // logger.info('Starting retry of pending failed syncs', { totalPending: pendingItems.length });
    // logger.debug('Starting retry of pending failed syncs', { totalPending: pendingItems.length });

    const results = {
      retried: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Retry pending items (those not yet synced). We only attempt items whose retryCount < maxRetries
    for (const item of pendingItems) {
      if (item.retryCount >= this.maxRetries) {
        logger.warn('Item reached max retries, skipping until marked failed', {
          hallTicket: item.hallTicket,
          biometricType: item.biometricType,
          retryCount: item.retryCount
        });
        continue;
      }

      const delay = Math.pow(2, item.retryCount) * this.baseDelay;

      logger.info('Retrying pending sync', {
        hallTicket: item.hallTicket,
        biometricType: item.biometricType,
        retryCount: item.retryCount,
        delay
      });

      // Wait for backoff delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // Don't reset retry count before attempting; let markAsFailed increment it on failure
      const candidateData = await this.getCandidateData(item.hallTicket);
      if (candidateData) {
        // Add image path from sync state
        const syncStatus = this.syncStateManager.getCandidateSyncStatus(item.hallTicket);
        if (syncStatus && syncStatus[item.biometricType]) {
          candidateData.localImagePath = syncStatus[item.biometricType].localPath;
        }
        
        try {
          const result = await this.syncBiometricData(candidateData, item.biometricType);
          results.retried++;

          if (result.success) {
            results.successful++;
          } else {
            results.failed++;
            results.errors.push({
              hallTicket: item.hallTicket,
              biometricType: item.biometricType,
              error: result.error
            });
          }
        } catch (syncError) {
          results.failed++;
          results.errors.push({
            hallTicket: item.hallTicket,
            biometricType: item.biometricType,
            error: syncError.message
          });
        }
      } else {
        logger.warn('Candidate data not found for retry', { hallTicket: item.hallTicket });
      }
    }

    this.syncInProgress = false;

    // logger.info('Retry process completed', results);
    logger.debug('Retry process completed', results);
    return results;
  }

  // Get candidate data (implement based on your data structure)
  async getCandidateData(hallTicket) {
    try {
      // This would typically fetch from your candidates data store
      const candidatesModule = require('../routes/candidates');
      const candidates = candidatesModule.getCandidates();
      const candidate = candidates.find(c => c.hallTicket === hallTicket);
      
      if (candidate) {
        return {
          hallTicket: candidate.hallTicket,
          id: candidate.id,
          candidateName: candidate.candidateName,
          emailId: candidate.emailId,
          phone: candidate.phone,
          gender: candidate.gender,
          centreCode: candidate.centreCode,
          centreName: candidate.centreName,
          examSlot: candidate.examSlot,
          examId: candidate.examId,
          userExamApplicationId: candidate.userExamApplicationId,
          timestamp: candidate.timestamp,
          faceData: candidate.faceCaptureData,
          thumbData: candidate.thumbCaptureData,
          ISOTemplateBase64: candidate.ISOTemplateBase64,
          TemplateBase64: candidate.TemplateBase64
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting candidate data for sync', {
        hallTicket,
        error: error.message
      });
      return null;
    }
  }

  // Sync all pending items
  async syncAllPending() {
    if (this.syncInProgress) {
      logger.warn('Sync already in progress, skipping');
      return [];
    }

    this.syncInProgress = true;
    const pendingItems = this.syncStateManager.getPendingSync();

    if (pendingItems.length === 0) {
      this.syncInProgress = false;
      // No logs for idle cycles
      return [];
    }

    // logger.info('Starting sync of all pending items', { totalPending: pendingItems.length });
    // logger.debug('Starting sync of all pending items', { totalPending: pendingItems.length });

    const results = [];

    for (const item of pendingItems) {
      const candidateData = await this.getCandidateData(item.hallTicket);
      if (candidateData) {
        // Add image path from sync state
        const syncStatus = this.syncStateManager.getCandidateSyncStatus(item.hallTicket);
        if (syncStatus && syncStatus[item.biometricType]) {
          candidateData.localImagePath = syncStatus[item.biometricType].localPath;
        }
        
        const result = await this.syncBiometricData(candidateData, item.biometricType);
        results.push({
          hallTicket: item.hallTicket,
          biometricType: item.biometricType,
          result
        });
      }
    }

    this.syncInProgress = false;

    // logger.info('Pending sync completed', {
    //   totalProcessed: results.length,
    //   successful: results.filter(r => r.result.success).length,
    //   failed: results.filter(r => !r.result.success).length
    // });
    logger.debug('Pending sync completed', {
      totalProcessed: results.length,
      successful: results.filter(r => r.result.success).length,
      failed: results.filter(r => !r.result.success).length
    });

    return results;
  }

  // Get sync status
  getSyncStatus() {
    return this.syncStateManager.getSyncStatus();
  }

  // Get sync statistics
  getSyncStatistics() {
    return this.syncStateManager.getSyncStatistics();
  }

  // Test connection to cloud backend
  async testCloudConnection() {
    try {
      const start = Date.now();
      await axios.get(`${this.cloudBackendUrl}/api/health`, { timeout: 5000 });
      const responseTime = `${Date.now() - start}ms`;
      return {
        connected: true,
        responseTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Fetch biometric records from cloud backend for the given hall tickets
  async fetchCloudBiometricRecords(candidateLookupKeys) {
    const requestId = `fetch_cloud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    if (!Array.isArray(candidateLookupKeys) || candidateLookupKeys.length === 0) {
      logger.warn('Empty candidate lookup keys array for cloud fetch', {
        requestId,
        candidateLookupKeys,
        reason: 'Invalid input'
      });
      
      return {
        success: true,
        totalRequested: 0,
        foundCount: 0,
        records: []
      };
    }

    try {
      logger.info('Fetching biometric records from cloud', {
        requestId,
        totalRequested: candidateLookupKeys.length,
        lookupKeys: candidateLookupKeys,
        cloudBackendUrl: this.cloudBackendUrl,
        timestamp: new Date().toISOString()
      });

      const response = await axios.post(
        `${this.cloudBackendUrl}/api/sync/biometric-records`,
        { 
          hallTickets: candidateLookupKeys,
          localBackendId: this.syncStateManager.localBackendId
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const processingTime = Date.now() - startTime;
      const responseData = response.data;

      logger.info('Cloud biometric records fetched successfully', {
        requestId,
        totalRequested: candidateLookupKeys.length,
        totalFound: responseData.foundCount || 0,
        faceCount: responseData.faceCount || 0,
        thumbCount: responseData.thumbCount || 0,
        templateCount: responseData.templateCount || 0,
        processingTime: `${processingTime}ms`,
        cloudProcessingTime: responseData.processingTime || 'N/A',
        timestamp: new Date().toISOString()
      });

      return responseData;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error.response?.data?.error || error.message;
      
      logger.error('Failed to fetch biometric records from cloud', {
        requestId,
        totalRequested: candidateLookupKeys.length,
        lookupKeys: candidateLookupKeys,
        error: errorMessage,
        errorCode: error.response?.status || 'NO_CODE',
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      });
      
      throw new Error(`Failed to fetch biometric records from cloud: ${errorMessage}`);
    }
  }
}

module.exports = SyncService;
