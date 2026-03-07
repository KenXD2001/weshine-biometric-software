const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');


// Use Electron's userData directory for all runtime files
const USER_DATA_PATH = process.env.USER_DATA_PATH || path.join(__dirname, '../../user_data_fallback');
const DATA_DIR = path.join(USER_DATA_PATH, 'data');
const UPLOADS_DATA_DIR = path.join(USER_DATA_PATH, 'uploads', 'candidates-data');
const CANDIDATES_FILE = path.join(DATA_DIR, 'candidates.json');
const CENTRE_INFO_FILE = path.join(DATA_DIR, 'centreInfo.json');
const CANDIDATES_BIOMETRIC_FILE = path.join(UPLOADS_DATA_DIR, 'candidates_biometric.json');

/**
 * Ensure data and uploads directories exist
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DATA_DIR, { recursive: true });
  } catch (error) {
    logger.error('Failed to create data/uploads directory', { error: error.message });
  }
}

/**
 * Save candidates to file (includes uploaded/live images from JSON)
 */
async function saveCandidates(candidates) {
  try {
    await ensureDataDir();
    
    // Include uploaded and live images (from JSON), but not captured images
    const candidateData = candidates.map(c => ({
      id: c.id,
      hallTicket: c.hallTicket,
      candidateName: c.candidateName,
      emailId: c.emailId,
      phone: c.phone,
      gender: c.gender,
      examId: c.examId,
      userExamApplicationId: c.userExamApplicationId,
      // Base64 images from JSON upload
      // Status tracking
      faceStatus: c.faceStatus,
      thumbStatus: c.thumbStatus,
      biometricStatus: c.biometricStatus,
      // Image paths
      uploadedImagePath: c.uploadedImagePath,
      liveImagePath: c.liveImagePath,
      capturedImagePath: c.capturedImagePath,
      biometricImagePath: c.biometricImagePath,
      // Centre details
      centreCode: c.centreCode,
      centreName: c.centreName,
      // Timestamps
      imageCaptureTimestamp: c.imageCaptureTimestamp,
      thumbCaptureTimestamp: c.thumbCaptureTimestamp,
      submitTimestamp: c.submitTimestamp
    }));
    
    await fs.writeFile(CANDIDATES_FILE, JSON.stringify(candidateData, null, 2), 'utf8');
    logger.info('Candidates saved to disk', { count: candidates.length });
    return true;
  } catch (error) {
    logger.error('Failed to save candidates', { error: error.message });
    return false;
  }
}

/**
 * Load candidates from file
 */
async function loadCandidates() {
  try {
    const data = await fs.readFile(CANDIDATES_FILE, 'utf8');
    const candidates = JSON.parse(data);
    logger.info('Candidates loaded from disk', { count: candidates.length });
    return candidates;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('No existing candidates file found, starting fresh');
      return [];
    }
    logger.error('Failed to load candidates', { error: error.message });
    return [];
  }
}

/**
 * Save centre info to file (with candidate counts)
 */
async function saveCentreInfo(centreInfo, candidates = []) {
  try {
    await ensureDataDir();
    
    // Calculate candidate counts
    const centreData = {
      code: centreInfo.code || '',
      name: centreInfo.name || '',
      examSlot: centreInfo.examSlot || '',
      candidate_counts: {
        total: candidates.length,
        completed: candidates.filter(c => c.biometricStatus === 'Completed').length,
        pending: candidates.filter(c => c.biometricStatus === 'Pending').length
      },
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(CENTRE_INFO_FILE, JSON.stringify(centreData, null, 2), 'utf8');
    logger.info('Centre info saved to disk', { 
      code: centreData.code,
      totalCandidates: centreData.candidate_counts.total
    });
    return true;
  } catch (error) {
    logger.error('Failed to save centre info', { error: error.message });
    return false;
  }
}

/**
 * Load centre info from file
 */
async function loadCentreInfo() {
  try {
    const data = await fs.readFile(CENTRE_INFO_FILE, 'utf8');
    const centreInfo = JSON.parse(data);
    logger.info('Centre info loaded from disk', centreInfo);
    return centreInfo;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('No existing centre info file found');
      return {};
    }
    logger.error('Failed to load centre info', { error: error.message });
    return {};
  }
}

/**
 * Save candidates biometric data (WITH base64 images - full data export)
 */
async function saveCandidatesBiometric(candidates) {
  try {
    await ensureDataDir();
    // also ensure uploads data directory exists
    await fs.mkdir(UPLOADS_DATA_DIR, { recursive: true });
    
    // Save biometric data WITH base64 images for complete export
    const biometricData = candidates.map(c => ({
      id: c.id,
      hallTicket: c.hallTicket,
      candidateName: c.candidateName,
      emailId: c.emailId,
      gender: c.gender,
      userExamApplicationId: c.userExamApplicationId,
      // Status tracking
      faceStatus: c.faceStatus,
      thumbStatus: c.thumbStatus,
      biometricStatus: c.biometricStatus,
      // Base64 image data (from JSON upload)
      // Captured biometric data (base64)
      faceCaptureData: c.faceCaptureData || null,  // Captured face image (base64)
      thumbCaptureData: c.thumbCaptureData || null, // Fingerprint data (base64)
      // Essential Template Fields Only
      ISOTemplateBase64: c.ISOTemplateBase64 || null,
      TemplateBase64: c.TemplateBase64 || null,
      // Image file paths (for reference)
      uploadedImagePath: c.uploadedImagePath,
      liveImagePath: c.liveImagePath,
      capturedImagePath: c.capturedImagePath,
      biometricImagePath: c.biometricImagePath,
      // Centre details
      centreCode: c.centreCode,
      centreName: c.centreName,
      // Timestamps
      imageCaptureTimestamp: c.imageCaptureTimestamp || null,
      thumbCaptureTimestamp: c.thumbCaptureTimestamp || null,
      submitTimestamp: c.submitTimestamp || null
    }));
    
    await fs.writeFile(CANDIDATES_BIOMETRIC_FILE, JSON.stringify(biometricData, null, 2), 'utf8');
    logger.info('Biometric data saved to disk (with images)', { count: biometricData.length });
    return true;
  } catch (error) {
    logger.error('Failed to save biometric data', { error: error.message });
    return false;
  }
}

/**
 * Load candidates biometric data from file
 */
async function loadCandidatesBiometric() {
  try {
    const data = await fs.readFile(CANDIDATES_BIOMETRIC_FILE, 'utf8');
    const biometricData = JSON.parse(data);
    logger.info('Biometric data loaded from disk', { count: biometricData.length });
    return biometricData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('No existing biometric data file found');
      return [];
    }
    logger.error('Failed to load biometric data', { error: error.message });
    return [];
  }
}

/**
 * Clear all stored data (when uploading new candidate data)
 */
async function clearAllData() {
  try {
    await saveCandidates([]);
    await saveCentreInfo({}, []);
    await saveCandidatesBiometric([]);
    logger.info('All data cleared from disk');
    return true;
  } catch (error) {
    logger.error('Failed to clear data', { error: error.message });
    return false;
  }
}

/**
 * Initialize data store - load existing data on server start
 */
async function initializeDataStore() {
  try {
    await ensureDataDir();
    const candidates = await loadCandidates();
    const centreInfo = await loadCentreInfo();
    
    logger.success('Data store initialized', { 
      candidatesCount: candidates.length,
      centreCode: centreInfo.code || 'N/A'
    });
    
    return { candidates, centreInfo };
  } catch (error) {
    logger.error('Failed to initialize data store', { error: error.message });
    return { candidates: [], centreInfo: {} };
  }
}

module.exports = {
  saveCandidates,
  loadCandidates,
  saveCentreInfo,
  loadCentreInfo,
  saveCandidatesBiometric,
  loadCandidatesBiometric,
  clearAllData,
  initializeDataStore
};

