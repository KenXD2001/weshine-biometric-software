const express = require('express');
const axios = require('axios');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const logger = require('../config/logger');
const imageStorage = require('../utils/imageStorage');
const SyncService = require('../services/syncService');

// Mock biometric data storage (replace with database in production)
const biometricData = new Map();

// Initialize sync service
const syncService = new SyncService();

// Helper function to convert base64 to image file
function base64ToImageFile(base64Data, imageType) {
  try {
    if (!base64Data) return null;

    // Remove data URI prefix if present (e.g., "data:image/png;base64,")
    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64String, 'base64');

    // Create temp directory in appropriate location (AppData in production, project in dev)
    let tempDir;
    if (process.env.NODE_ENV === 'production' && process.resourcesPath) {
      // In packaged Electron, use AppData directory
      const os = require('os');
      const path = require('path');
      tempDir = path.join(os.tmpdir(), 'digi-biometric-temp');
    } else {
      // In dev, use project directory
      tempDir = path.join(__dirname, '../../.temp-biometric-images');
    }
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save as PNG file
    const fileName = `${imageType}_${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);
    
    fs.writeFileSync(filePath, buffer);

    logger.info('Converted base64 to image file', {
      imageType,
      fileName,
      sizeBytes: buffer.length,
      tempDir
    });

    return filePath; // Return file path for sending
  } catch (error) {
    logger.error('Error converting base64 to image file', {
      imageType,
      error: error.message
    });
    return null;
  }
}

// Helper function to sync biometric data to cloud backend with actual image files
async function syncBiometricDataToCloud(biometricPayload) {
  const tempFiles = []; // Track temp files for cleanup
  
  try {
    const cloudBackendUrl = process.env.CLOUD_BACKEND_URL || 'http://localhost:8040';
    
    logger.info('Sending biometric data to cloud backend', {
      hallTicket: biometricPayload.hallTicket,
      captureType: biometricPayload.captureType,
      cloudUrl: cloudBackendUrl,
      hasFaceImage: !!biometricPayload.faceImagePath,
      hasThumbImage: !!biometricPayload.thumbImagePath
    });

    // Prepare FormData for multipart upload
    const formData = new FormData();
    
    // Add metadata as JSON string
    formData.append('metadata', JSON.stringify({
      hallTicket: biometricPayload.hallTicket,
      slot: biometricPayload.slot || biometricPayload.examSlot || null,
      candidateId: biometricPayload.userExamApplicationId || biometricPayload.candidateId,
      candidateName: biometricPayload.candidateName,
      emailId: biometricPayload.emailId,
      phone: biometricPayload.phone,
      gender: biometricPayload.gender,
      captureType: biometricPayload.captureType,
      centreCode: biometricPayload.centreCode,
      centreName: biometricPayload.centreName,
      examSlot: biometricPayload.examSlot,
      examId: biometricPayload.examId,
      userExamApplicationId: biometricPayload.userExamApplicationId,
      timestamp: biometricPayload.timestamp,
      localBackendId: biometricPayload.localBackendId,
      // Essential Template Fields Only
      ISOTemplateBase64: biometricPayload.ISOTemplateBase64,
      TemplateBase64: biometricPayload.TemplateBase64
    }));

    // Add image files if they exist
    if (biometricPayload.faceImagePath && fs.existsSync(biometricPayload.faceImagePath)) {
      formData.append('faceImage', fs.createReadStream(biometricPayload.faceImagePath));
      tempFiles.push(biometricPayload.faceImagePath);
    }

    if (biometricPayload.thumbImagePath && fs.existsSync(biometricPayload.thumbImagePath)) {
      formData.append('thumbImage', fs.createReadStream(biometricPayload.thumbImagePath));
      tempFiles.push(biometricPayload.thumbImagePath);
    }

    const response = await axios.post(
      `${cloudBackendUrl}/api/biometric-details/submit`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000 // 30 second timeout for file upload
      }
    );

    if (response.data && response.data.successful) {
      logger.success('Biometric data synced to cloud backend', {
        hallTicket: biometricPayload.hallTicket,
        cloudResponseId: response.data.id,
        imagesStored: response.data.imagesStored
      });
      return {
        success: true,
        cloudId: response.data.id,
        message: 'Data synced to cloud successfully'
      };
    } else {
      throw new Error(response.data?.message || 'Cloud sync failed');
    }
  } catch (error) {
    logger.warn('Cloud sync error (data still saved locally)', {
      hallTicket: biometricPayload.hallTicket,
      error: error.message,
      code: error.code,
      status: error.response?.status
    });
    // Don't throw - let local save succeed even if cloud sync fails
    return {
      success: false,
      error: error.message,
      message: 'Saved locally, cloud sync pending'
    };
  } finally {
    // Cleanup temp files
    tempFiles.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info('Cleaned up temp image file', { filePath });
        }
      } catch (err) {
        logger.warn('Failed to cleanup temp file', { filePath, error: err.message });
      }
    });
  }
}

// Submit face capture data
router.post('/submit-face-capture', async (req, res) => {
  try {
    const { faceData, hallTicket, slot, userExamApplicationId } = req.body;
    
    logger.info('Submitting face capture', { 
      hallTicket,
      slot,
      userExamApplicationId,
      ip: req.ip 
    });

    if (!faceData || !hallTicket) {
      return res.status(400).json({
        successful: false,
        message: 'Face data and hall ticket are required'
      });
    }

    // Update candidate's face status
    const candidatesModule = require('./candidates');
    const candidates = candidatesModule.getCandidates();
    const candidate = candidates.find(c => c.hallTicket === hallTicket);
    
    if (!candidate) {
      return res.status(404).json({
        successful: false,
        message: 'Candidate not found'
      });
    }

    // Save captured face image to disk
    const capturedImagePath = imageStorage.saveBase64Image(faceData, hallTicket, 'captured');
    
    candidate.faceCaptureData = faceData;
    candidate.capturedImagePath = capturedImagePath;
    candidate.faceStatus = 'Completed';
    // Use provided timestamp if available, else fallback
    candidate.imageCaptureTimestamp = req.body.captureTimestamp || new Date().toISOString();
    
    // Update overall biometric status
    if (candidate.faceStatus === 'Completed' && candidate.thumbStatus === 'Completed') {
      candidate.biometricStatus = 'Completed';
      candidate.submitTimestamp = candidate.submitTimestamp || new Date().toISOString();
    }

    // Save to disk (saves to all 3 JSON files)
    await candidatesModule.saveToDisk();

    logger.success('Face capture submitted successfully', { 
      hallTicket,
      candidateId: candidate.id,
      submitTimestamp: candidate.submitTimestamp
    });

    // ASYNC: Send face data to cloud using new sync service
    (async () => {
      try {
        // Reset sync state so manual recapture is uploaded again
        syncService.syncStateManager.updateSyncStatus(candidate.hallTicket, 'face', {
          synced: false,
          error: null,
          retryCount: 0,
          localPath: capturedImagePath
        });
        
        const candidateData = {
          hallTicket,
          id: candidate.id,
          candidateName: candidate.candidateName,
          emailId: candidate.emailId,
          phone: candidate.phone || '',
          gender: candidate.gender || 'other',
          centreCode: candidate.centreCode || (require('./candidates').getCentreInfo().code || ''),
          centreName: candidate.centreName || (require('./candidates').getCentreInfo().name || ''),
          examSlot: candidate.examSlot || candidate.slot || (require('./candidates').getCentreInfo().examSlot || ''),
          slot: slot || candidate.slot || candidate.examSlot || (require('./candidates').getCentreInfo().examSlot || ''),
          examId: candidate.examId || '',
          userExamApplicationId: userExamApplicationId || candidate.userExamApplicationId || candidate.applicationNumber || '',
          timestamp: candidate.imageCaptureTimestamp,
          faceData: faceData,
          thumbData: null,
          ISOTemplateBase64: null,
          TemplateBase64: null,
          localImagePath: capturedImagePath // Add image path for sync
        };
        
        await syncService.syncBiometricData(candidateData, 'face', { force: true });
      } catch (syncError) {
        if (syncError) logger.error('Face sync error:', syncError);
      }
    })();

    res.json({
      successful: true,
      message: 'Face capture submitted successfully'
    });

  } catch (error) {
    logger.error('Error submitting face capture', {
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

// Submit thumb capture data
router.post('/submit-thumb-capture', async (req, res) => {
  try {
    const { thumbData, hallTicket, slot, userExamApplicationId, ISOTemplateBase64, TemplateBase64, deviceApiResponse, secugenApiResponse } = req.body;
    const rawDeviceResponse = deviceApiResponse || secugenApiResponse;
    
    logger.info('Submitting thumb capture', { 
      hallTicket,
      hasISOTemplate: !!ISOTemplateBase64,
      isoTemplateLength: ISOTemplateBase64 ? ISOTemplateBase64.length : 0,
      hasTemplate: !!TemplateBase64,
      templateLength: TemplateBase64 ? TemplateBase64.length : 0,
      hasDeviceResponse: !!rawDeviceResponse,
      deviceResponseKeys: rawDeviceResponse ? Object.keys(rawDeviceResponse) : [],
      ip: req.ip 
    });

    if (!thumbData || !hallTicket) {
      return res.status(400).json({
        successful: false,
        message: 'Thumb data and hall ticket are required'
      });
    }

    // Update candidate's thumb status
    const candidatesModule = require('./candidates');
    const candidates = candidatesModule.getCandidates();
    const candidate = candidates.find(c => c.hallTicket === hallTicket);
    
    if (!candidate) {
      return res.status(404).json({
        successful: false,
        message: 'Candidate not found'
      });
    }

    // Save fingerprint image to disk
    const biometricImagePath = imageStorage.saveBase64Image(thumbData, hallTicket, 'biometric');
    
    candidate.thumbCaptureData = thumbData;
    candidate.biometricImagePath = biometricImagePath;
    candidate.thumbStatus = 'Completed';
    
    const deviceResponse = rawDeviceResponse || {};
    candidate.ISOTemplateBase64 = deviceResponse.ISOTemplateBase64 || ISOTemplateBase64 || null;
    candidate.TemplateBase64 = deviceResponse.TemplateBase64 || TemplateBase64 || null;

    logger.info('Assigned thumb biometric templates', {
      hallTicket,
      candidateId: candidate.id,
      ISOTemplateBase64Exists: !!candidate.ISOTemplateBase64,
      TemplateBase64Exists: !!candidate.TemplateBase64,
      ISOTemplateLength: candidate.ISOTemplateBase64 ? candidate.ISOTemplateBase64.length : 0,
      TemplateLength: candidate.TemplateBase64 ? candidate.TemplateBase64.length : 0
    });
    
    // Use provided timestamp if available, else fallback
    candidate.thumbCaptureTimestamp = req.body.captureTimestamp || new Date().toISOString();
    
    // Update overall biometric status
    if (candidate.faceStatus === 'Completed' && candidate.thumbStatus === 'Completed') {
      candidate.biometricStatus = 'Completed';
      candidate.submitTimestamp = candidate.submitTimestamp || new Date().toISOString();
    }

    // Save to disk (saves to all 3 JSON files)
    await candidatesModule.saveToDisk();

    logger.success('Thumb capture submitted successfully', { 
      hallTicket,
      candidateId: candidate.id,
      hasDeviceResponse: !!rawDeviceResponse,
      responseErrorCode: rawDeviceResponse?.ErrorCode,
      submitTimestamp: candidate.submitTimestamp
    });

    // ASYNC: Send thumb data to cloud using new sync service
    (async () => {
      try {
        // Reset sync state so manual recapture is uploaded again
        syncService.syncStateManager.updateSyncStatus(candidate.hallTicket, 'thumb', {
          synced: false,
          error: null,
          retryCount: 0,
          localPath: biometricImagePath
        });
        
        const candidateData = {
          hallTicket,
          id: candidate.id,
          candidateName: candidate.candidateName,
          emailId: candidate.emailId,
          phone: candidate.phone || '',
          gender: candidate.gender || 'other',
          centreCode: candidate.centreCode || (require('./candidates').getCentreInfo().code || ''),
          centreName: candidate.centreName || (require('./candidates').getCentreInfo().name || ''),
          examSlot: candidate.examSlot || candidate.slot || (require('./candidates').getCentreInfo().examSlot || ''),
          slot: slot || candidate.slot || candidate.examSlot || (require('./candidates').getCentreInfo().examSlot || ''),
          examId: candidate.examId || '',
          userExamApplicationId: userExamApplicationId || candidate.userExamApplicationId || candidate.applicationNumber || '',
          timestamp: candidate.thumbCaptureTimestamp,
          faceData: null,
          thumbData: thumbData,
          ISOTemplateBase64: candidate.ISOTemplateBase64 || null,
          TemplateBase64: candidate.TemplateBase64 || null,
          localImagePath: biometricImagePath // Add image path for sync
        };
        
        await syncService.syncBiometricData(candidateData, 'thumb', { force: true });
      } catch (syncError) {
        logger.error('Thumb sync error:', syncError);
      }
    })();

    res.json({
      successful: true,
      message: 'Thumb capture submitted successfully'
    });

  } catch (error) {
    logger.error('Error submitting thumb capture', {
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

// Legacy endpoint - keep for backward compatibility
router.post('/submit-biometric-string', async (req, res) => {
  try {
    const { biometricData: bioData, hallTicket } = req.body;
    
    logger.info('Submitting biometric data (legacy)', { 
      hallTicket, 
      dataLength: bioData?.length || 0,
      ip: req.ip 
    });

    if (!bioData || !hallTicket) {
      return res.status(400).json({
        successful: false,
        message: 'Biometric data and hall ticket are required'
      });
    }

    // Store biometric data in map
    biometricData.set(hallTicket, {
      data: bioData,
      timestamp: new Date().toISOString(),
      hallTicket
    });

    // Update candidate - mark both face and thumb as completed
    const candidatesModule = require('./candidates');
    const candidates = candidatesModule.getCandidates();
    const candidate = candidates.find(c => c.hallTicket === hallTicket);
    
    if (candidate) {
      candidate.thumbCaptureData = bioData;
      candidate.thumbStatus = 'Completed';
      candidate.faceStatus = 'Completed';
      candidate.biometricStatus = 'Completed';
      
      // Save to disk
      await candidatesModule.saveToDisk();
      
      logger.info('Updated candidate biometric status (legacy)', { 
        hallTicket, 
        candidateId: candidate.id 
      });
    }

    logger.success('Biometric data submitted successfully (legacy)', { 
      hallTicket,
      dataSize: bioData.length
    });

    res.json({
      successful: true,
      message: 'Biometric data submitted successfully'
    });

  } catch (error) {
    logger.error('Error submitting biometric data', {
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

// Get biometric details by hall ticket
router.get('/:hallTicket', (req, res) => {
  try {
    const { hallTicket } = req.params;
    
    logger.info('Fetching biometric details', { hallTicket, ip: req.ip });

    const bioData = biometricData.get(hallTicket);
    
    if (!bioData) {
      logger.warn('Biometric data not found', { hallTicket, ip: req.ip });
      return res.status(404).json({
        successful: false,
        message: 'Biometric data not found'
      });
    }

    res.json({
      successful: true,
      data: bioData
    });

  } catch (error) {
    logger.error('Error fetching biometric details', {
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

// Delete biometric details by hall ticket
router.post('/delete/:hallTicket', (req, res) => {
  try {
    const { hallTicket } = req.params;
    
    logger.info('Deleting biometric details', { hallTicket, ip: req.ip });

    const existed = biometricData.has(hallTicket);
    
    if (!existed) {
      logger.warn('Biometric data not found for deletion', { hallTicket, ip: req.ip });
      return res.status(404).json({
        successful: false,
        message: 'Biometric data not found'
      });
    }

    biometricData.delete(hallTicket);

    logger.success('Biometric data deleted successfully', { hallTicket });

    res.json({
      successful: true,
      message: 'Biometric data deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting biometric details', {
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

// Get all biometric data (for admin purposes)
router.get('/', (req, res) => {
  try {
    logger.info('Fetching all biometric data', { ip: req.ip });

    const allData = Array.from(biometricData.values());

    res.json({
      successful: true,
      data: allData,
      count: allData.length
    });

  } catch (error) {
    logger.error('Error fetching all biometric data', {
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

// Batch sync all completed biometric captures to cloud
router.post('/sync-all-to-cloud', async (req, res) => {
  try {
    const candidatesModule = require('./candidates');
    const candidates = candidatesModule.getCandidates();
    
    // Find all candidates with completed biometric
    const toSync = candidates.filter(c => c.biometricStatus === 'Completed');
    
    logger.info('Starting batch sync to cloud', { 
      totalCompleted: toSync.length,
      ip: req.ip 
    });
    
    const results = {
      successful: 0,
      failed: 0,
      total: toSync.length,
      synced: [],
      errors: []
    };
    
    // Sync each candidate
    for (const candidate of toSync) {
      try {
        const syncResult = await syncBiometricDataToCloud({
          // Candidate Identification
          hallTicket: candidate.hallTicket,
          slot: candidate.slot || candidate.examSlot || '',
          candidateId: candidate.id,
          candidateName: candidate.candidateName,
          emailId: candidate.emailId,
          phone: candidate.phone || '',
          gender: candidate.gender || 'other',
          
          // Biometric Data
          faceData: candidate.faceCaptureData || null,
          thumbData: candidate.thumbCaptureData || null,
          captureType: 'both',
          
          // Essential Template Fields Only
          ISOTemplateBase64: candidate.ISOTemplateBase64 || null,
          TemplateBase64: candidate.TemplateBase64 || null,
          
          // Centre Information
          centreCode: candidate.centreCode,
          centreName: candidate.centreName,
          examSlot: candidate.examSlot,
          
          // Exam Information
          examId: candidate.examId || '',
          userExamApplicationId: candidate.userExamApplicationId || candidate.applicationNumber || '',
          
          // Sync Metadata
          timestamp: candidate.thumbCaptureTimestamp || new Date().toISOString(),
          localBackendId: process.env.LOCAL_BACKEND_ID || 'local-biometric-center-1'
        });
        
        if (syncResult.success) {
          candidate.syncedToCloud = true;
          candidate.syncedAt = new Date().toISOString();
          candidate.cloudId = syncResult.cloudId;
          results.successful++;
          results.synced.push({
            hallTicket: candidate.hallTicket,
            status: 'success',
            cloudId: syncResult.cloudId
          });
        } else {
          candidate.syncError = syncResult.error;
          candidate.syncedToCloud = false;
          results.failed++;
          results.errors.push({
            hallTicket: candidate.hallTicket,
            error: syncResult.error
          });
        }
      } catch (error) {
        candidate.syncError = error.message;
        candidate.syncedToCloud = false;
        results.failed++;
        results.errors.push({
          hallTicket: candidate.hallTicket,
          error: error.message
        });
      }
    }
    
    // Save updated candidates data
    await candidatesModule.saveToDisk();
    
    logger.success('Batch sync completed', results);
    
    res.json({
      successful: true,
      data: results,
      message: `Synced ${results.successful} candidates successfully, ${results.failed} failed`
    });
    
  } catch (error) {
    logger.error('Error in batch sync', {
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

module.exports = router;
