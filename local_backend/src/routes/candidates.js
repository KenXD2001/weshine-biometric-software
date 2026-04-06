const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const dataStore = require('../utils/dataStore');
const pdfExporter = require('../services/pdfExporter');
const path = require('path');
const fs = require('fs');

// Persistent storage - data loaded from disk on server start
let candidates = [];
let centreInfo = {
  code: '',
  name: '',
  examSlot: ''
};

const sanitizeCandidate = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const { faceCaptureData, thumbCaptureData, ...rest } = candidate;
  return rest;
};

const sanitizeCandidates = (candidateList) => {
  if (!Array.isArray(candidateList)) return [];
  return candidateList.map(sanitizeCandidate);
};

const getISTDateTime = () => {
  const now = new Date();
  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffsetMillis = 5.5 * 60 * 60000;
  const istTime = new Date(utcMillis + istOffsetMillis);

  const yyyy = istTime.getFullYear();
  const mm = String(istTime.getMonth() + 1).padStart(2, '0');
  const dd = String(istTime.getDate()).padStart(2, '0');
  const hh = String(istTime.getHours()).padStart(2, '0');
  const min = String(istTime.getMinutes()).padStart(2, '0');
  const ss = String(istTime.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

const convertUtcToIST = (utcTimestamp) => {
  if (!utcTimestamp) return '-';

  const date = new Date(utcTimestamp);
  if (Number.isNaN(date.getTime())) return utcTimestamp;

  const utcMillis = date.getTime();
  const istOffsetMillis = 5.5 * 60 * 60000;
  const istDate = new Date(utcMillis + istOffsetMillis);

  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  const hh = String(istDate.getHours()).padStart(2, '0');
  const min = String(istDate.getMinutes()).padStart(2, '0');
  const ss = String(istDate.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
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
      const biometricFilePath = path.join(__dirname, '../../data/candidate_biometric_details.json');
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
      data: sanitizeCandidate(candidate)
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
      data: sanitizeCandidates(filteredCandidates),
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

// Helper to render HTML rows in export template
const resolveImageUrl = (imgPath) => {
  if (!imgPath) return '';
  if (typeof imgPath !== 'string') return '';

  const trimmed = imgPath.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const serverHost = process.env.EXPORT_PDF_HOST || `http://127.0.0.1:${process.env.PORT || 8080}`;
  if (trimmed.startsWith('/')) {
    return `${serverHost}${trimmed}`;
  }

  return `${serverHost}/${trimmed}`;
};

const imgTag = (url) => {
  if (!url) return '-';
  return `<img src="${url}" alt="img" style="max-width:80px; max-height:60px; object-fit:contain;" />`;
};

const buildCandidateTableRows = (candidateList) => {
  return candidateList.map(c => {
    const signatureImg = imgTag(resolveImageUrl(c.uploadedImagePath || c.liveImagePath));
    const photoImg = imgTag(resolveImageUrl(c.liveImagePath || c.uploadedImagePath));
    const capturedPhotoImg = imgTag(resolveImageUrl(c.capturedImagePath));
    const capturedThumbImg = imgTag(resolveImageUrl(c.biometricImagePath));

    return `
    <tr>
      <td class="nowrap">${c.hallTicket || '-'}</td>
      <td>${c.candidateName || '-'}</td>
      <td>${c.emailId || '-'}</td>
      <td>${c.gender || '-'}</td>
      <td>${signatureImg}</td>
      <td>${photoImg}</td>
      <td>${capturedPhotoImg}</td>
      <td>${capturedThumbImg}</td>
      <td>${c.biometricStatus || '-'}</td>
      <td class="nowrap small">
        ${convertUtcToIST(c.imageCaptureTimestamp)}<br/>
        ${convertUtcToIST(c.thumbCaptureTimestamp)}<br/>
        ${convertUtcToIST(c.submitTimestamp)}
      </td>
    </tr>
  `;
  }).join('');
};

// Export PDF endpoint
router.get('/export/pdf', async (req, res) => {
  try {
    let filteredCandidates = [...candidates];
    const { hallTicket, candidateName, status } = req.query;

    if (hallTicket) {
      filteredCandidates = filteredCandidates.filter(c => c.hallTicket.toLowerCase().includes(String(hallTicket).toLowerCase()));
    }
    if (candidateName) {
      filteredCandidates = filteredCandidates.filter(c => c.candidateName.toLowerCase().includes(String(candidateName).toLowerCase()));
    }
    if (status && status !== 'all') {
      filteredCandidates = filteredCandidates.filter(c => String(c.biometricStatus || '').toLowerCase() === String(status).toLowerCase());
    }

    const pdfBuffer = await pdfExporter.createBiometricPdf(filteredCandidates);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="biometric-candidate-list.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF export error details:', error);
    logger.error('Error generating PDF export', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).send(`PDF generation failed: ${error.message}`);
  }
});

// Export diagnostic biometric file JSON from data directory
router.get('/export/json', async (req, res) => {
  try {
    const biometricFilePath = path.join(__dirname, '../../data/candidate_biometric_details.json');
    if (!fs.existsSync(biometricFilePath)) {
      logger.warn('JSON export requested but file not found', { file: biometricFilePath });
      return res.status(404).json({ successful: false, message: 'Biometric JSON file not found' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="candidate_biometric_details.json"');
    const stream = fs.createReadStream(biometricFilePath);
    stream.pipe(res);

    stream.on('end', () => {
      logger.success('Biometric JSON exported', { file: biometricFilePath, ip: req.ip });
    });

    stream.on('error', (streamError) => {
      logger.error('Error streaming biometric JSON file', { error: streamError.message, ip: req.ip });
      res.status(500).end('Failed to export biometric JSON file');
    });
  } catch (error) {
    logger.error('Error exporting biometric JSON', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({ successful: false, message: 'Internal server error' });
  }
});

// Get candidate count by centre code
router.get('/counts', (req, res) => {
  try {
    const { centreCode, examId, examSlot } = req.query;
    
    logger.info('Fetching candidate counts', { centreCode, examId, examSlot, ip: req.ip });

    // Filter candidates by centre code if provided
    let filteredCandidates = candidates;
    if (centreCode) {
      filteredCandidates = candidates.filter(c => c.centreCode === centreCode);
    }

    // Mock count based on exam and slot (or centre)
    const candidateCounts = {
      total: filteredCandidates.length,
      completed: filteredCandidates.filter(c => c.biometricStatus === 'Completed').length,
      pending: filteredCandidates.filter(c => c.biometricStatus === 'Pending').length
    };

    res.json({
      successful: true,
      candidateCounts: candidateCounts
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
    
const biometricFilePath = path.join(__dirname, '../../data/candidate_biometric_details.json');
    
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

  // Replace full candidate array in one operation
  setCandidates: async (newCandidates) => {
    candidates.length = 0;
    if (Array.isArray(newCandidates)) {
      candidates.push(...newCandidates);
    }
    await dataStore.saveCandidates(candidates);
    await dataStore.saveCentreInfo(centreInfo, candidates);
    await dataStore.saveCandidatesBiometric(candidates);
  },

  // Keep only candidates that exist in provided key set (hallTicket or id) for merge semantics
  retainCandidatesByKeySet: async (keySet) => {
    if (!keySet || !(keySet instanceof Set)) {
      return;
    }

    const remainingCandidates = candidates.filter((c) => {
      const candidateKey = (c.hallTicket || c.id || '').toString();
      return keySet.has(candidateKey);
    });

    candidates.length = 0;
    candidates.push(...remainingCandidates);
    await dataStore.saveCandidates(candidates);
    await dataStore.saveCentreInfo(centreInfo, candidates);
    await dataStore.saveCandidatesBiometric(candidates);
  },
  
  // Keep router as export
  router: router
};
