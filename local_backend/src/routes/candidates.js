const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const dataStore = require('../utils/dataStore');
const path = require('path');
const fs = require('fs');

// Persistent storage - data loaded from disk on server start
let candidates = [];
let centreInfo = {
  code: '',
  name: '',
  examSlot: ''
};

// Initialize data from disk on module load
(async () => {
  try {
    const { candidates: loadedCandidates, centreInfo: loadedCentreInfo } = await dataStore.initializeDataStore();
    
    // Load from regular candidates.json (now includes uploaded/live images)
    candidates.push(...loadedCandidates);
    
    if (loadedCentreInfo.code) {
      centreInfo.code = loadedCentreInfo.code;
      centreInfo.name = loadedCentreInfo.name;
      centreInfo.examSlot = loadedCentreInfo.examSlot;
    }
    
    logger.success('Candidates and centre info restored from persistent storage', {
      candidatesCount: candidates.length,
      centreCode: centreInfo.code || 'None'
    });
  } catch (error) {
    logger.error('Failed to load data from storage', { error: error.message });
  }
})();

// Get all candidate details by hall ticket (with biometric data if available)
router.get('/all', (req, res) => {
  try {
    const { hallTicket } = req.query;
    
    logger.info('Fetching candidate details', { hallTicket, ip: req.ip });

    if (!hallTicket) {
      return res.status(400).json({
        successful: false,
        message: 'Hall ticket is required'
      });
    }

    // First check if candidate exists in regular candidates array
    let candidate = candidates.find(c => c.hallTicket === hallTicket);
    
    if (!candidate) {
      logger.warn('Candidate not found', { hallTicket, ip: req.ip });
      return res.status(404).json({
        successful: false,
        message: 'Candidate not found'
      });
    }

    // Try to get biometric data if available (candidates_biometric.json)
    try {
      const biometricFilePath = path.join(__dirname, '../../uploads/candidates-data/candidates_biometric.json');
      if (fs.existsSync(biometricFilePath)) {
        const fileContent = fs.readFileSync(biometricFilePath, 'utf8');
        const biometricData = JSON.parse(fileContent);
        const biometricCandidate = biometricData.find(c => c.hallTicket === hallTicket);
        
        // If biometric data exists, merge it with candidate data
        if (biometricCandidate) {
          candidate = {
            ...candidate,
            ...biometricCandidate,
            // Keep the basic info from candidates.json if not in biometric
            id: candidate.id,
            candidateName: biometricCandidate.candidateName || candidate.candidateName,
            emailId: biometricCandidate.emailId || candidate.emailId,
            phone: biometricCandidate.phone || candidate.phone,
            gender: biometricCandidate.gender || candidate.gender,
          };
          logger.info('Merged biometric data with candidate details', { hallTicket });
        }
      }
    } catch (bioError) {
      logger.warn('Could not load biometric data, using regular candidate data', {
        hallTicket,
        error: bioError.message
      });
    }

    logger.success('Candidate details retrieved', { hallTicket, candidateId: candidate.id });

    res.json({
      successful: true,
      data: candidate
    });

  } catch (error) {
    logger.error('Error fetching candidate details', {
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

// Get filtered candidate details
router.get('/all/filters', (req, res) => {
  try {
    const filters = req.query;
    
    logger.info('Fetching filtered candidate details', { filters, ip: req.ip });

    let filteredCandidates = [...candidates];

    // Apply filters if provided
    if (filters.hallTicket) {
      filteredCandidates = filteredCandidates.filter(c => 
        c.hallTicket.toLowerCase().includes(filters.hallTicket.toLowerCase())
      );
    }

    if (filters.candidateName) {
      filteredCandidates = filteredCandidates.filter(c => 
        c.candidateName.toLowerCase().includes(filters.candidateName.toLowerCase())
      );
    }

    res.json({
      successful: true,
      data: filteredCandidates,
      count: filteredCandidates.length
    });

  } catch (error) {
    logger.error('Error fetching filtered candidate details', {
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

// Get candidate count by exam and slot
router.get('/counts', (req, res) => {
  try {
    const { examId, examSlot } = req.query;
    
    logger.info('Fetching candidate counts', { examId, examSlot, ip: req.ip });

    // Mock count based on exam and slot
    const candidateCounts = {
      total: candidates.length,
      completed: candidates.filter(c => c.biometricStatus === 'Completed').length,
      pending: candidates.filter(c => c.biometricStatus === 'Pending').length
    };

    res.json({
      successful: true,
      candidateCounts: candidateCounts.total
    });

  } catch (error) {
    logger.error('Error fetching candidate counts', {
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

// Match candidate - simply check if hall ticket exists in uploaded data
router.get('/match', (req, res) => {
  try {
    const { hallTicket } = req.query;
    
    logger.info('Checking if candidate exists', { hallTicket, ip: req.ip });

    if (!hallTicket) {
      return res.status(400).json({
        successful: false,
        message: 'Hall ticket is required'
      });
    }

    // Simply check if candidate with this hall ticket exists
    const candidate = candidates.find(c => c.hallTicket === hallTicket);
    
    if (!candidate) {
      logger.warn('Candidate not found', { hallTicket, ip: req.ip });
      return res.status(404).json({
        code: 'NO_MATCH',
        message: 'Candidate not found'
      });
    }

    // Candidate found - return success
    logger.success('Candidate found', { 
      hallTicket, 
      candidateId: candidate.id,
      candidateName: candidate.candidateName
    });

    res.json({
      code: 'MATCH',
      message: 'Candidate found successfully'
    });

  } catch (error) {
    logger.error('Error checking candidate', {
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

// Get centre information (from uploaded candidate data)
router.get('/centre-info', (req, res) => {
  try {
    logger.info('Fetching centre info', { ip: req.ip });

    // Return centre info from the uploaded data
    const info = {
      centreCode: centreInfo.code || '',
      centreName: centreInfo.name || '',
      examSlot: centreInfo.examSlot || '',
      // Parse exam slot to extract date and session if available
      examDate: centreInfo.examSlot ? [centreInfo.examSlot.split(' ')[0]] : [],
      sessions: centreInfo.examSlot ? [centreInfo.examSlot.split(' ')[1]] : [],
      session: centreInfo.examSlot ? centreInfo.examSlot.split(' ')[1] : '',
      date: centreInfo.examSlot ? centreInfo.examSlot.split(' ')[0] : '',
      hasCandidates: candidates.length > 0
    };

    logger.success('Centre info retrieved', { 
      centreCode: info.centreCode || 'None',
      candidatesCount: candidates.length
    });

    res.json({
      successful: true,
      data: info
    });

  } catch (error) {
    logger.error('Error fetching centre info', {
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

// Get biometric data JSON for download
router.get('/biometric-data', (req, res) => {
  try {
    logger.info('Downloading biometric data JSON', { ip: req.ip });
    
const biometricFilePath = path.join(__dirname, '../../uploads/candidates-data/candidates_biometric.json');
    
    if (!fs.existsSync(biometricFilePath)) {
      // If file doesn't exist, return current candidates data
      logger.warn('Biometric JSON file not found, returning current data', { ip: req.ip });
      return res.json(candidates);
    }
    
    // Read and send the file
    const fileContent = fs.readFileSync(biometricFilePath, 'utf8');
    const biometricData = JSON.parse(fileContent);
    
    logger.success('Biometric data JSON downloaded', { 
      count: biometricData.length,
      ip: req.ip 
    });
    
    res.json(biometricData);
    
  } catch (error) {
    logger.error('Error downloading biometric data', {
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

// Export functions to access and modify the data (with auto-save to disk)
module.exports = {
  getCandidates: () => candidates,
  
  addCandidate: (candidate) => {
    candidates.push(candidate);
    // Auto-save to disk after adding
    dataStore.saveCandidates(candidates).catch(err => 
      logger.error('Failed to auto-save candidates', { error: err.message })
    );
  },
  
  clearCandidates: () => {
    candidates.length = 0;
    // Auto-save to disk after clearing
    dataStore.saveCandidates(candidates).catch(err => 
      logger.error('Failed to auto-save candidates', { error: err.message })
    );
  },
  
  getCentreInfo: () => centreInfo,
  
  setCentreInfo: (info) => {
    centreInfo.code = info.code;
    centreInfo.name = info.name;
    centreInfo.examSlot = info.examSlot;
    // Auto-save to disk after setting (with candidate counts)
    dataStore.saveCentreInfo(centreInfo, candidates).catch(err => 
      logger.error('Failed to auto-save centre info', { error: err.message })
    );
  },
  
  // Manual save functions (for batch operations)
  saveToDisk: async () => {
    await dataStore.saveCandidates(candidates);
    await dataStore.saveCentreInfo(centreInfo, candidates);
    await dataStore.saveCandidatesBiometric(candidates);
  },
  
  // Keep router as export
  router: router
};
