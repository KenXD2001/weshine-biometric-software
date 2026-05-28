const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const imageStorage = require('../utils/imageStorage');

// Mock biometric data storage (replace with database in production)
const biometricData = new Map();

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

// Submit face capture data
router.post('/submit-face-capture', async (req, res) => {
  try {
    const { faceData, hallTicket, applicationNumber, slot, userExamApplicationId } = req.body;
    const lookupKey = hallTicket || applicationNumber || userExamApplicationId || '';
    
    logger.info('Submitting face capture', { 
      hallTicket,
      applicationNumber,
      slot,
      userExamApplicationId,
      ip: req.ip 
    });

    if (!faceData || !lookupKey) {
      return res.status(400).json({
        successful: false,
        message: 'Face data and application number are required'
      });
    }

    // Update candidate's face status
    const candidatesModule = require('./candidates');
    const candidates = candidatesModule.getCandidates();
    const normalizedLookup = String(lookupKey).trim().toLowerCase();
    const candidate = candidates.find((c) => {
      const candidateKey = String(c.hallTicket || c.applicationNumber || c.userExamApplicationId || c.id || '').trim().toLowerCase();
      return candidateKey === normalizedLookup;
    });
    
    if (!candidate) {
      return res.status(404).json({
        successful: false,
        message: 'Candidate not found'
      });
    }

    const candidateIdentifier = candidate.applicationNumber || candidate.hallTicket || candidate.userExamApplicationId || candidate.id || lookupKey;
    const capturedImagePath = imageStorage.saveBase64Image(faceData, candidateIdentifier, 'captured');
    
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
      applicationNumber: candidate.applicationNumber || candidate.hallTicket || candidate.id,
      candidateId: candidate.id,
      submitTimestamp: candidate.submitTimestamp
    });

    logger.info('Face capture submitted locally', {
      applicationNumber: candidate.applicationNumber || candidate.hallTicket || candidate.id,
      capturedImagePath
    });

    res.json({
      successful: true,
      message: 'Face capture submitted successfully (local only)'
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
    const { thumbData, hallTicket, applicationNumber, slot, userExamApplicationId, ISOTemplateBase64, TemplateBase64, deviceApiResponse, secugenApiResponse } = req.body;
    const rawDeviceResponse = deviceApiResponse || secugenApiResponse;
    const lookupKey = hallTicket || applicationNumber || userExamApplicationId || '';
    
    logger.info('Submitting thumb capture', { 
      hallTicket,
      applicationNumber,
      hasISOTemplate: !!ISOTemplateBase64,
      isoTemplateLength: ISOTemplateBase64 ? ISOTemplateBase64.length : 0,
      hasTemplate: !!TemplateBase64,
      templateLength: TemplateBase64 ? TemplateBase64.length : 0,
      hasDeviceResponse: !!rawDeviceResponse,
      deviceResponseKeys: rawDeviceResponse ? Object.keys(rawDeviceResponse) : [],
      ip: req.ip 
    });

    const hasThumbData = Boolean(thumbData);
    const deviceResponse = rawDeviceResponse || {};
    const hasDeviceTemplate = Boolean(deviceResponse?.ISOTemplateBase64 || deviceResponse?.TemplateBase64);

    if (!lookupKey) {
      return res.status(400).json({
        successful: false,
        message: 'Application number is required'
      });
    }

    // Allow submission with existing template data when no new thumbData is provided
    if (!hasThumbData && !ISOTemplateBase64 && !TemplateBase64 && !hasDeviceTemplate) {
      return res.status(400).json({
        successful: false,
        message: 'Thumb data or existing template data is required for submission'
      });
    }

    // Update candidate's thumb status
    const candidatesModule = require('./candidates');
    const candidates = candidatesModule.getCandidates();
    const normalizedLookup = String(lookupKey).trim().toLowerCase();
    const candidate = candidates.find((c) => {
      const candidateKey = String(c.hallTicket || c.applicationNumber || c.userExamApplicationId || c.id || '').trim().toLowerCase();
      return candidateKey === normalizedLookup;
    });
    
    if (!candidate) {
      return res.status(404).json({
        successful: false,
        message: 'Candidate not found'
      });
    }

    const candidateIdentifier = candidate.applicationNumber || candidate.hallTicket || candidate.userExamApplicationId || candidate.id || lookupKey;

    if (thumbData) {
      const biometricImagePath = imageStorage.saveBase64Image(thumbData, candidateIdentifier, 'biometric');
      candidate.thumbCaptureData = thumbData;
      candidate.biometricImagePath = biometricImagePath;
    }

    candidate.thumbStatus = 'Completed';
    candidate.ISOTemplateBase64 = deviceResponse.ISOTemplateBase64 || ISOTemplateBase64 || candidate.ISOTemplateBase64 || null;
    candidate.TemplateBase64 = deviceResponse.TemplateBase64 || TemplateBase64 || candidate.TemplateBase64 || null;

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
      applicationNumber: candidate.applicationNumber || candidate.hallTicket || candidate.id,
      candidateId: candidate.id,
      hasDeviceResponse: !!rawDeviceResponse,
      responseErrorCode: rawDeviceResponse?.ErrorCode,
      submitTimestamp: candidate.submitTimestamp
    });

    logger.info('Thumb capture submitted locally', {
      applicationNumber: candidate.applicationNumber || candidate.hallTicket || candidate.id,
      biometricImagePath
    });

    res.json({
      successful: true,
      message: 'Thumb capture submitted successfully (local only)'
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

module.exports = router;
