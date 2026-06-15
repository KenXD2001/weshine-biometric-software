const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');

// Base directories for backend data
const APP_ROOT = path.join(__dirname, '../../');
const DATA_DIR = path.join(APP_ROOT, 'data');
const UPLOADS_ROOT = path.join(APP_ROOT, 'uploads');
const UPLOADS_DATA_DIR = path.join(UPLOADS_ROOT, 'candidates-data');
const CANDIDATES_DIR = path.join(DATA_DIR, 'candidates-data');
const CANDIDATES_FILE = path.join(DATA_DIR, 'candidates.json');
const CENTRE_INFO_FILE = path.join(DATA_DIR, 'centreInfo.json');
const CANDIDATES_BIOMETRIC_FILE = path.join(DATA_DIR, 'candidate_biometric_details.json');
const SYNC_STATE_FILE = path.join(DATA_DIR, 'sync-state.json');

/**
 * Ensure data and uploads directories exist
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(CANDIDATES_DIR, { recursive: true });
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

    const now = new Date().toISOString();
    const candidateData = candidates.map(c => ({
      id: c.id,
      applicationNumber: c.applicationNumber || c.hallTicket || c.userExamApplicationId || c.id || '',
      candidateName: c.candidateName,
      emailId: c.emailId,
      gender: c.gender,
      uploadedImagePath: c.uploadedImagePath || '',
      uploadedSignaturePath: c.liveImagePath || c.uploadedSignaturePath || '',
      created_at: c.created_at || c.createdAt || now,
      updated_at: now
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

    const now = new Date().toISOString();
    const centreData = {
      centreCode: centreInfo.centreCode || '',
      centreName: centreInfo.centreName || '',
      examDate: centreInfo.examDate || '',
      examSlot: centreInfo.examSlot || '',
      candidate_counts: {
        total: candidates.length,
        completed: candidates.filter(c => c.biometricStatus === 'Completed').length,
        pending: candidates.filter(c => c.biometricStatus === 'Pending').length
      },
      created_at: centreInfo.created_at || centreInfo.createdAt || now,
      updated_at: now
    };

    await fs.writeFile(CENTRE_INFO_FILE, JSON.stringify(centreData, null, 2), 'utf8');
    logger.info('Centre info saved to disk', {
      code: centreData.centreCode,
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
    await fs.mkdir(UPLOADS_DATA_DIR, { recursive: true });

    const now = new Date().toISOString();
    const biometricData = candidates.map(c => ({
      id: c.id,
      candidateId: c.id,
      webcamStatus: c.webcamStatus || 'Pending',
      thumbStatus: c.thumbStatus || 'Pending',
      biometricStatus: c.biometricStatus || 'Pending',
      webcamCaptureData: c.webcamCaptureData || null,
      thumbCaptureData: c.thumbCaptureData || null,
      capturedThumbIsoTemplate: c.capturedThumbIsoTemplate || null,
      capturedThumbAnsiTemplate: c.capturedThumbAnsiTemplate || null,
      capturedWebcamImagePath: c.webcamImagePath || null,
      capturedThumbImagePath: c.biometricImagePath || null,
      webcamCaptureTimestamp: c.webcamCaptureTimestamp || null,
      thumbCaptureTimestamp: c.thumbCaptureTimestamp || null,
      submitTimestamp: c.submitTimestamp || null,
      created_at: c.created_at || c.createdAt || now,
      updated_at: now
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
    try {
      await fs.unlink(SYNC_STATE_FILE);
      logger.info('Cleared sync state file from disk');
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn('Failed to delete sync state file during clearAllData', { error: err.message });
      }
    }
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
    const biometricData = await loadCandidatesBiometric();

    const biometricMap = new Map(
      biometricData.map((item) => [String(item.candidateId || item.id || '').trim().toLowerCase(), item])
    );

    const mergedCandidates = candidates.map((candidate) => {
      const lookupKey = String(candidate.id || candidate.applicationNumber || candidate.hallTicket || '').trim().toLowerCase();
      const biometricRecord = biometricMap.get(lookupKey) || {};

      return {
        ...candidate,
        uploadedImagePath: candidate.uploadedImagePath || '',
        liveImagePath: candidate.uploadedSignaturePath || candidate.liveImagePath || '',
        uploadedSignaturePath: candidate.uploadedSignaturePath || candidate.liveImagePath || '',
        webcamStatus: biometricRecord.webcamStatus || candidate.webcamStatus || 'Pending',
        thumbStatus: biometricRecord.thumbStatus || candidate.thumbStatus || 'Pending',
        biometricStatus: biometricRecord.biometricStatus || candidate.biometricStatus || 'Pending',
        webcamCaptureData: biometricRecord.webcamCaptureData || candidate.webcamCaptureData || null,
        thumbCaptureData: biometricRecord.thumbCaptureData || candidate.thumbCaptureData || null,
        capturedThumbIsoTemplate: biometricRecord.capturedThumbIsoTemplate || candidate.capturedThumbIsoTemplate || null,
        capturedThumbAnsiTemplate: biometricRecord.capturedThumbAnsiTemplate || candidate.capturedThumbAnsiTemplate || null,
        ISOTemplateBase64: biometricRecord.capturedThumbIsoTemplate || candidate.capturedThumbIsoTemplate || null,
        TemplateBase64: biometricRecord.capturedThumbAnsiTemplate || candidate.capturedThumbAnsiTemplate || null,
        webcamImagePath: biometricRecord.capturedWebcamImagePath || candidate.webcamImagePath || '',
        biometricImagePath: biometricRecord.capturedThumbImagePath || candidate.biometricImagePath || '',
        webcamCaptureTimestamp: biometricRecord.webcamCaptureTimestamp || candidate.webcamCaptureTimestamp || null,
        thumbCaptureTimestamp: biometricRecord.thumbCaptureTimestamp || candidate.thumbCaptureTimestamp || null,
        submitTimestamp: biometricRecord.submitTimestamp || candidate.submitTimestamp || null,
        created_at: candidate.created_at || candidate.createdAt || biometricRecord.created_at || biometricRecord.createdAt || new Date().toISOString(),
        updated_at: biometricRecord.updated_at || biometricRecord.updatedAt || candidate.updated_at || candidate.updatedAt || new Date().toISOString()
      };
    });

    logger.success('Data store initialized', {
      candidatesCount: mergedCandidates.length,
      centreCode: centreInfo.centreCode || 'N/A'
    });

    return { candidates: mergedCandidates, centreInfo };
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

