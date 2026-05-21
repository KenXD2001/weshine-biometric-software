const express = require('express');
const multer = require('multer');
const router = express.Router();
const logger = require('../config/logger');
const path = require('path');
const fs = require('fs');
const imageStorage = require('../utils/imageStorage');
const AdmZip = require('adm-zip');

// CSV parser with proper quoted field handling
function parseCSV(csvContent) {
  const normalizedContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalizedContent) {
    throw new Error('CSV file is empty or has no data rows');
  }

  function splitCSVRows(content) {
    const rows = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
          continue;
        }
        insideQuotes = !insideQuotes;
        current += char;
      } else if (char === '\n' && !insideQuotes) {
        rows.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    if (current !== '') {
      rows.push(current);
    }

    return rows;
  }

  const lines = splitCSVRows(normalizedContent);
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  // Helper function to parse CSV line with quoted values
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote inside a quoted field
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  // Parse header row
  const headerValues = parseCSVLine(lines[0]);
  const headers = headerValues.map(h => h.replace(/^"|"$/g, '')); // Remove surrounding quotes
  
  logger.info('CSV Headers parsed', { headers });
  
  // Parse data rows
  const candidates = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue; // Skip empty lines
    
    const values = parseCSVLine(line).map(v => v.replace(/^"|"$/g, '')); // Remove surrounding quotes
    const candidate = {};
    
    headers.forEach((header, index) => {
      candidate[header] = values[index] || '';
    });
    
    logger.info(`CSV Row ${i} parsed`, { 
      candidate,
      hasAppNumber: !!(candidate['Application Number'] || candidate['applicationNumber']),
      hasFullName: !!(candidate['Full Name'] || candidate['fullName'])
    });
    
    // Normalize common CSV fields to the internal expected keys
    if (candidate['Email']) {
      candidate.email = candidate['Email'];
    }
    if (candidate['Email ID']) {
      candidate.emailId = candidate['Email ID'];
    }
    if (candidate['applicationNumber']) {
      candidate.applicationNumber = candidate['applicationNumber'];
    }
    if (candidate['Application Number']) {
      candidate.applicationNumber = candidate['Application Number'];
    }
    if (candidate['Full Name']) {
      candidate.fullName = candidate['Full Name'];
    }
    if (candidate['candidateName']) {
      candidate.candidateName = candidate['candidateName'];
    }

    // Check if candidate has required fields - support both formats
    const appNumber = candidate.applicationNumber || candidate.AppNumber || candidate.app_number;
    const fullName = candidate.fullName || candidate.FullName || candidate.full_name;

    if (appNumber || fullName) {
      candidates.push(candidate);
    }
  }
  
  return candidates;
}

function normalizeSlotLabel(slotValue) {
  const normalized = String(slotValue || '').trim().toLowerCase();
  if (!normalized) return '';

  if (normalized.includes('slot one') || normalized.includes('slot 1') || normalized === 'a') {
    return 'slot_one';
  }

  if (normalized.includes('slot two') || normalized.includes('slot 2') || normalized === 'b') {
    return 'slot_two';
  }

  return normalized;
}

function resolveCandidateHallTicket(candidate, examSlot) {
  const slotKey = normalizeSlotLabel(
    candidate.examSlot || candidate.slot || candidate['Exam Slot'] || examSlot
  );

  const slotOneHallTicket =
    candidate.slotOneHallticket ||
    candidate.slotOneHallTicket ||
    candidate['Slot One Hallticket'] ||
    candidate['Slot One HallTicket'] ||
    candidate.slot_one_hallticket;

  const slotTwoHallTicket =
    candidate.slotTwoHallticket ||
    candidate.slotTwoHallTicket ||
    candidate['Slot Two Hallticket'] ||
    candidate['Slot Two HallTicket'] ||
    candidate.slot_two_hallticket;

  const directHallTicket =
    candidate.hallTicketId ||
    candidate.hallTicket ||
    candidate['Hall Ticket'] ||
    candidate['HallTicket'] ||
    candidate.hallticket;

  if (slotKey === 'slot_one' && slotOneHallTicket) return String(slotOneHallTicket).trim();
  if (slotKey === 'slot_two' && slotTwoHallTicket) return String(slotTwoHallTicket).trim();

  return String(directHallTicket || slotOneHallTicket || slotTwoHallTicket || '').trim();
}

function resolveCandidateCity(candidate, fallbackCity = '') {
  return (
    candidate.city ||
    candidate.cityName ||
    candidate.cityPreference ||
    candidate['City'] ||
    candidate['City Name'] ||
    candidate['City Preference'] ||
    fallbackCity ||
    ''
  );
}

function resolveCandidateCentreCode(candidate, fallbackCentreCode = '') {
  return (
    candidate.centreCode ||
    candidate.centerCode ||
    candidate['Centre Code'] ||
    fallbackCentreCode ||
    ''
  );
}

function resolveCandidateExamSlot(candidate, fallbackExamSlot = '') {
  return (
    candidate.examSlot ||
    candidate.slot ||
    candidate['Exam Slot'] ||
    fallbackExamSlot ||
    ''
  );
}

function resolveCandidateCentreName(candidate, fallbackCentreName = '') {
  return (
    candidate.centreName ||
    candidate.centre ||
    candidate.centerName ||
    candidate.center ||
    candidate['Centre Name'] ||
    candidate['Centre'] ||
    fallbackCentreName ||
    ''
  );
}

function parseJwtPayload(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function getCentreInfoFromRequestAuth(req) {
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const payload = parseJwtPayload(token);
  if (!payload) return null;

  return {
    code: payload.centreCode || payload.centerCode || '',
    name: payload.centreName || payload.centerName || '',
    city: payload.city || payload.cityName || '',
  };
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use a safe, writable directory for uploads in production
    let uploadDir;
    if (process.env.NODE_ENV === 'production' && process.resourcesPath) {
      // In packaged Electron, use resources/uploads (outside asar)
      uploadDir = path.join(process.resourcesPath, 'uploads');
    } else {
      // In dev, use project uploads folder
      uploadDir = path.join(__dirname, '../../uploads');
    }
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 209715200, // 200MB default
  },
  fileFilter: (req, file, cb) => {
    const fileName = file.originalname.toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    
    // Check file extension
    const isZipFile = fileName.endsWith('.zip');
    const isImageFile = mimeType.startsWith('image/');
    
    // Check MIME type for ZIP
    const isZipMime = mimeType === 'application/zip' || 
                      mimeType === 'application/x-zip-compressed' || 
                      mimeType === 'application/x-zip';
    
    // Allow files based on extension OR MIME type
    if ((isZipFile || isZipMime) || isImageFile) {
      cb(null, true);
    } else {
      logger.warn('File upload rejected - invalid type', {
        fileName: file.originalname,
        mimeType: file.mimetype,
        ip: req.ip
      });
      cb(new Error('Invalid file type. Only ZIP and image files are allowed.'), false);
    }
  }
});

// Upload candidate CSV/JSON file
router.post('/file', upload.single('file'), (req, res) => {
  try {
    logger.info('Upload endpoint hit', {
      ip: req.ip,
      fileType: req.query.fileType,
      hallTicket: req.query.hallTicket,
      matchPercentage: req.query.matchPercentage
    });
    const { fileType, hallTicket, matchPercentage, uploadMode = 'replace' } = req.query;
    const sanitizedUploadMode = (uploadMode || 'replace').toString().toLowerCase();
    const file = req.file;

    logger.info('File upload request', {
      fileType,
      hallTicket,
      matchPercentage,
      uploadMode: sanitizedUploadMode,
      fileName: file?.originalname,
      fileSize: file?.size,
      ip: req.ip
    });

    if (!file) {
      logger.error('No file uploaded', { ip: req.ip });
      return res.status(400).json({
        successful: false,
        message: 'No file uploaded'
      });
    }

    // Check minimum file size (40KB = 40960 bytes)
    const minFileSize = parseInt(process.env.MIN_FILE_SIZE) || 40960;
    if (file.size < minFileSize) {
      logger.error('File too small', { fileSize: file.size, minFileSize });
      return res.status(400).json({
        successful: false,
        message: `File too small. Minimum size is 40KB. Your file is ${(file.size / 1024).toFixed(2)}KB.`
      });
    }

    if (!fileType) {
      logger.error('File type is required', { ip: req.ip });
      return res.status(400).json({
        successful: false,
        message: 'File type is required'
      });
    }

    // Process based on file type
    if (fileType === 'ZIP') {
      return processCandidateZIP(req, res, file, sanitizedUploadMode);
    } else if (fileType === 'IMAGE') {
      return processBiometricImage(req, res, file, hallTicket, matchPercentage);
    } else {
      logger.error('Invalid file type', { fileType });
      return res.status(400).json({
        successful: false,
        message: 'Invalid file type. Supported: ZIP, IMAGE'
      });
    }

  } catch (error) {
    logger.error('File upload error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      file: req.file?.originalname,
      fileType: req.query.fileType
    });
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          successful: false,
          message: 'File too large. Maximum size is 200MB.'
        });
      }
    }
    res.status(500).json({
      successful: false,
      message: `Internal server error: ${error.message}`
    });
  }
});

// Process candidate data file (JSON/CSV)
async function cleanupExistingCandidateData() {
  const dataStore = require('../utils/dataStore');

  try {
    // Clear candidate JSON state
    await dataStore.clearAllData();

    // Delete data/candidates-data folder content to remove old images
    const dataCandidatesDir = path.join(__dirname, '../../data/candidates-data');
    if (fs.existsSync(dataCandidatesDir)) {
      fs.rmSync(dataCandidatesDir, { recursive: true, force: true });
    }
  } catch (err) {
    logger.warn('Failed to cleanup existing candidate data', { error: err.message });
  }
}

async function processCandidateFile(req, res, file, uploadMode = 'replace') {
  try {
    logger.info('Processing candidate data file', {
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      uploadMode,
      ip: req.ip
    });

    if (uploadMode === 'replace') {
      await cleanupExistingCandidateData();
    }

    // Read file content
    const fileContent = fs.readFileSync(file.path, 'utf8');
    
    logger.info('File content length', { 
      length: fileContent.length,
      firstChars: fileContent.substring(0, 200),
      fileType: file.mimetype
    });
    
    // Transform the candidate data to match our internal format
    const candidatesModule = require('./candidates');
    const existingCandidates = candidatesModule.getCandidates() || [];
    const existingCandidateMap = new Map(existingCandidates.map(c => [
      (c.hallTicket || c.id || '').toString(),
      c
    ]));
    const uploadedCandidateKeys = new Set();

    if (uploadMode === 'replace') {
      candidatesModule.clearCandidates();
    }
    
    const failedCandidates = [];
    let successCount = 0;

    // Use stored centre info from candidates module if available.
    // Do NOT use any hard-coded/mock centre defaults here.
    let centreInfo = candidatesModule.getCentreInfo() || { code: '', name: '', cityName: '', examSlot: '' };
    const tokenCentreInfo = getCentreInfoFromRequestAuth(req);
    if (tokenCentreInfo) {
      centreInfo.code = centreInfo.code || tokenCentreInfo.code;
      centreInfo.name = centreInfo.name || tokenCentreInfo.name;
      centreInfo.cityName = centreInfo.cityName || tokenCentreInfo.city;
    }

    let candidates = [];
    
    // Detect and parse file format
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      // Parse CSV format
      logger.info('Parsing CSV file');
      try {
        candidates = parseCSV(fileContent);
        logger.success('CSV parsed successfully', { 
          candidatesCount: candidates.length
        });
      } catch (parseError) {
        logger.error('CSV parse error', { 
          error: parseError.message
        });
        throw new Error(`CSV parsing failed: ${parseError.message}`);
      }
    } else {
      // Parse JSON format
      logger.info('Parsing JSON file');
      try {
        let jsonData = JSON.parse(fileContent);
        
        // Handle if JSON is wrapped in an array
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          jsonData = jsonData[0]; // Extract first element
        }
        
        // Log the structure
        const topLevelKeys = Object.keys(jsonData);
        logger.info('JSON parsed successfully', { 
          topLevelKeys: topLevelKeys,
          isArray: Array.isArray(jsonData),
          hasCentre: !!jsonData.centre,
          hasCandidates: !!(jsonData.centre && jsonData.centre.candidates),
          candidatesCount: jsonData.centre?.candidates?.length || 0
        });

        // Validate JSON structure - expects {centre: {candidates: []}} format
        if (!jsonData.centre) {
          throw new Error('Invalid JSON format: Missing "centre" property');
        }
        
        if (!jsonData.centre.candidates) {
          throw new Error('Invalid JSON format: Missing "candidates" array in centre');
        }
        
        if (!Array.isArray(jsonData.centre.candidates)) {
          throw new Error('Invalid JSON format: "candidates" must be an array');
        }

        // Update centre information from JSON if provided
        if (jsonData.centre && jsonData.centre.code) {
          centreInfo.code = jsonData.centre.code;
          centreInfo.name = jsonData.centre.name || centreInfo.name || '';
          centreInfo.cityName = jsonData.centre.city || jsonData.centre.cityName || centreInfo.cityName || '';
          centreInfo.examSlot = jsonData.centre.examSlot || centreInfo.examSlot || '';
        } else if (!centreInfo || !centreInfo.code) {
          // No centre info available from JSON or stored data
          throw new Error('Centre information missing in uploaded JSON and no stored centre assigned. Please login to assign a centre or include centre metadata in the upload.');
        }
        
        candidates = jsonData.centre.candidates;
      } catch (parseError) {
        logger.error('JSON parse error', { 
          error: parseError.message,
          position: parseError.position || 'unknown'
        });
        throw new Error(`JSON parsing failed: ${parseError.message}`);
      }
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        successful: false,
        message: 'No candidates found in file'
      });
    }

    const firstCandidateWithCity = candidates.find((candidate) =>
      resolveCandidateCity(candidate, '').trim().length > 0
    );
    if (firstCandidateWithCity) {
      centreInfo.cityName = resolveCandidateCity(firstCandidateWithCity, '').trim();
    }

    const firstCandidateWithCentreCode = candidates.find((candidate) =>
      resolveCandidateCentreCode(candidate, '').trim().length > 0
    );
    if (firstCandidateWithCentreCode) {
      centreInfo.code = resolveCandidateCentreCode(firstCandidateWithCentreCode, '').trim();
    }

    const firstCandidateWithExamSlot = candidates.find((candidate) =>
      resolveCandidateExamSlot(candidate, '').trim().length > 0
    );
    if (firstCandidateWithExamSlot) {
      centreInfo.examSlot = resolveCandidateExamSlot(firstCandidateWithExamSlot, '').trim();
    }

    if ((!centreInfo || !String(centreInfo.code || '').trim()) && tokenCentreInfo?.code) {
      centreInfo.code = tokenCentreInfo.code;
      centreInfo.name = centreInfo.name || tokenCentreInfo.name || '';
      centreInfo.cityName = centreInfo.cityName || tokenCentreInfo.city || '';
    }

    if (!centreInfo || !String(centreInfo.code || '').trim()) {
      return res.status(400).json({
        successful: false,
        message: 'Centre information not available in uploaded data. Please ensure ZIP CSV contains Centre Code/Centre Name/City/Exam Slot metadata.'
      });
    }

    const firstCandidateWithCentreName = candidates.find((candidate) =>
      resolveCandidateCentreName(candidate, '').trim().length > 0
    );
    const inferredCentreName = firstCandidateWithCentreName
      ? resolveCandidateCentreName(firstCandidateWithCentreName, '')
      : '';

    const centreNameEqualsCity =
      String(centreInfo.name || '').trim().toLowerCase() !== '' &&
      String(centreInfo.name || '').trim().toLowerCase() === String(centreInfo.cityName || '').trim().toLowerCase();

    if (inferredCentreName && (!centreInfo.name || centreNameEqualsCity)) {
      centreInfo.name = inferredCentreName;
    }
    
    // Persist centre info only if we have a valid centre code (comes from JSON or stored data)
    if (centreInfo && centreInfo.code) {
      candidatesModule.setCentreInfo(centreInfo);
    }

    // Process each candidate
    candidates.forEach((candidate, index) => {
      try {
        logger.info(`Processing candidate ${index + 1}`, {
          candidateId: candidate.candidateId || candidate.applicationNumber,
          candidateName: candidate.candidateName || candidate.fullName,
          hasDocumentDetails: !!candidate.documentDetails,
          documentDetailsCount: candidate.documentDetails?.length || 0
        });

        // Get candidate ID (support both formats)
        const candidateId = candidate.candidateId || candidate.applicationNumber;
        const candidateName = candidate.candidateName || candidate.fullName || '';

        if (!candidateId || !candidateName) {
          throw new Error('Missing candidateId/applicationNumber or candidateName/fullName');
        }

        const hallTicket = resolveCandidateHallTicket(candidate, centreInfo.examSlot);
        if (!hallTicket) {
          throw new Error('Missing hall ticket for candidate');
        }
        const candidateKey = (hallTicket || candidateId).toString();
        uploadedCandidateKeys.add(candidateKey);

        // Merge mode: skip candidate if already exists (preserve biometric history)
        if (uploadMode === 'merge' && existingCandidateMap.has(candidateKey)) {
          const existingCandidate = existingCandidateMap.get(candidateKey);
          logger.info('Skipping existing candidate in merge mode', {
            candidateId: existingCandidate.id,
            hallTicket: existingCandidate.hallTicket
          });
          return;
        }

        // Extract images from documentDetails array (if present)

        // Validate required fields
        if (!candidateId || !candidateName) {
          throw new Error('Missing candidateId/applicationNumber or candidateName/fullName');
        }

        // Extract images from documentDetails array (if present)
        const photoDoc = candidate.documentDetails?.find(doc => doc.documentTypeName === 'PHOTO');
        const livePhotoDoc = candidate.documentDetails?.find(doc => doc.documentTypeName === 'LIVE-PHOTO');

        logger.info(`Candidate ${index + 1} documents found`, {
          hasPhoto: !!photoDoc,
          hasLivePhoto: !!livePhotoDoc,
          photoLength: photoDoc?.fileName?.length || 0,
          livePhotoLength: livePhotoDoc?.fileName?.length || 0
        });

        // Save uploaded and live images to disk (if available)
        let uploadedImagePath = null;
        let liveImagePath = null;
        
        // hallTicket is already computed and used for candidateKey selection.
        
        if (photoDoc?.fileName) {
          try {
            uploadedImagePath = imageStorage.saveBase64Image(
              photoDoc.fileName, 
              hallTicket, 
              'photo'
            );
          } catch (err) {
            logger.warn(`Failed to save uploaded image for ${hallTicket}`, { error: err.message });
          }
        }
        
        if (livePhotoDoc?.fileName) {
          try {
            liveImagePath = imageStorage.saveBase64Image(
              livePhotoDoc.fileName, 
              hallTicket, 
              'signature'
            );
          } catch (err) {
            logger.warn(`Failed to save live image for ${hallTicket}`, { error: err.message });
          }
        }
        
        // Create candidate object with face and thumb status tracking
        const normalizedEmail = candidate.emailId || candidate.email || candidate.Email || candidate.EmailId || candidate.emailid;
        const resolvedCandidateCentreCode = centreInfo.code || resolveCandidateCentreCode(candidate, centreInfo.code);
        const resolvedCandidateExamSlot = centreInfo.examSlot || resolveCandidateExamSlot(candidate, centreInfo.examSlot);
        const resolvedCentreName = centreInfo.name || resolveCandidateCentreName(candidate, centreInfo.name);
        const resolvedCandidateCity = centreInfo.cityName || resolveCandidateCity(candidate, centreInfo.cityName);
        const candidateObj = {
          id: candidateId,
          hallTicket: hallTicket,
          candidateName: candidateName,
          emailId: normalizedEmail || `${candidateName.toLowerCase().replace(/\s+/g, '')}@example.com`,
          gender: (candidate.gender || candidate.Gender || 'other').toLowerCase(),
          image: photoDoc?.fileName || '',
          liveImage: livePhotoDoc?.fileName || '',
          userExamApplicationId: candidate.userExamApplicationId || candidate.applicationNumber || '',
          // Biometric tracking
          faceStatus: 'Pending',  // Pending, Completed
          thumbStatus: 'Pending', // Pending, Completed
          biometricStatus: 'Pending', // Pending, Completed
          faceCaptureData: null,
          thumbCaptureData: null,
          matchPercentage: null,
          // Cloud sync tracking
          syncedToCloud: false,
          syncedAt: null,
          syncError: null,
          cloudId: null,
          // Image file paths (data folder API path)
          uploadedImagePath: uploadedImagePath || '',
          liveImagePath: liveImagePath || '',
          capturedImagePath: null,
          biometricImagePath: null,
          // Centre details
          centreCode: resolvedCandidateCentreCode,
          centreName: resolvedCentreName,
          city: resolvedCandidateCity,
          examSlot: resolvedCandidateExamSlot,
          // Timestamps (initially null)
          imageCaptureTimestamp: null,
          thumbCaptureTimestamp: null,
          submitTimestamp: null
        };

        // Add to candidates array
        candidatesModule.addCandidate(candidateObj);
        successCount++;
        
        logger.info(`Candidate ${index + 1} processed successfully`, {
          candidateId: candidateObj.id,
          hallTicket: candidateObj.hallTicket
        });
      } catch (err) {
        // Don't log full candidate data (contains large base64 images)
        logger.error(`Failed to process candidate ${index + 1}`, {
          error: err.message,
          stack: err.stack,
          candidateId: candidate.candidateId || candidate.applicationNumber,
          candidateName: candidate.candidateName || candidate.fullName
        });
        failedCandidates.push(`Candidate ${index + 1}: ${err.message}`);
      }
    });

    // For merge mode, remove candidates no longer present in upload set
    if (uploadMode === 'merge') {
      await candidatesModule.retainCandidatesByKeySet(uploadedCandidateKeys);
    }

    logger.success('Candidate data file processed', {
      fileName: file.originalname,
      totalCandidates: candidates.length,
      successful: successCount,
      failed: failedCandidates.length,
      centreCode: centreInfo.code,
      centreName: centreInfo.name,
      examSlot: centreInfo.examSlot,
      ip: req.ip
    });

    // Save all data to disk (candidates.json, centreInfo.json, candidates_biometric.json)
    try {
      await candidatesModule.saveToDisk();
      logger.info('All candidate data saved to disk after upload');
    } catch (saveError) {
      logger.error('Failed to save data to disk after upload', { error: saveError.message });
    }

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    if (failedCandidates.length > 0) {
      const errorMessage = `Processed ${successCount} candidates successfully. ${failedCandidates.length} candidates failed validation.`;
      return res.json({
        successful: false,
        message: errorMessage,
        error: failedCandidates.join(' | '),
        centreInfo: centreInfo
      });
    }

    res.json({
      successful: true,
      message: `Successfully processed ${successCount} candidates from ${centreInfo.name}`,
      data: {
        processedCount: jsonData.centre.candidates.length,
        successfulCount: successCount,
        failedCount: failedCandidates.length,
        centreInfo: centreInfo
      }
    });

  } catch (error) {
    logger.error('Error processing candidate file', {
      error: error.message,
      fileName: file.originalname,
      ip: req.ip
    });

    // Clean up uploaded file on error
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.status(400).json({
      successful: false,
      message: 'Error processing file. Please check file format and try again.',
      error: error.message
    });
  }
}

// Process candidate ZIP file
async function processCandidateZIP(req, res, file, uploadMode = 'replace') {
  // Use proper upload directory path like multer configuration
  let uploadBaseDir;
  if (process.env.NODE_ENV === 'production' && process.resourcesPath) {
    // In packaged Electron, use resources/uploads (outside asar)
    uploadBaseDir = path.join(process.resourcesPath, 'uploads');
  } else {
    // In dev, use project uploads folder
    uploadBaseDir = path.join(__dirname, '../../uploads');
  }
  
  const extractionDir = path.join(uploadBaseDir, 'candidates-data', 'extracted');

  if (uploadMode === 'replace') {
    // Clean application data before reimporting
    const dataStore = require('../utils/dataStore');
    await dataStore.clearAllData();
    const dataCandidatesDir = path.join(__dirname, '../../data/candidates-data');
    if (fs.existsSync(dataCandidatesDir)) {
      fs.rmSync(dataCandidatesDir, { recursive: true, force: true });
    }
  }
  
  try {
    logger.info('Processing candidate ZIP file', {
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      extractionDir,
      ip: req.ip
    });

    // Clean old extracted data if present
    if (fs.existsSync(extractionDir)) {
      const oldItems = fs.readdirSync(extractionDir);
      for (const item of oldItems) {
        const itemPath = path.join(extractionDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          fs.rmSync(itemPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(itemPath);
        }
      }
    }

    // Create extraction directory
    if (!fs.existsSync(extractionDir)) {
      fs.mkdirSync(extractionDir, { recursive: true });
    }

    // Extract ZIP file
    logger.info('Extracting ZIP file', { extractionDir });
    try {
      const zip = new AdmZip(file.path);
      zip.extractAllTo(extractionDir, true);
      logger.info('ZIP file extracted successfully');
    } catch (extractError) {
      throw new Error(`Failed to extract ZIP file: ${extractError.message}`);
    }

    // Read metadata file if present in ZIP (preferred source for centre/city/slot).
    logger.info('Searching for metadata and candidate data file in ZIP');

    let zipMetadata = null;

    function searchForMetadataFile(dirPath) {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isFile() && item.toLowerCase() === 'metadata.json') {
          try {
            const metadataRaw = fs.readFileSync(itemPath, 'utf8');
            zipMetadata = JSON.parse(metadataRaw);
            logger.info('Found metadata.json in ZIP', { path: itemPath });
          } catch (metadataError) {
            logger.warn('Failed to parse metadata.json from ZIP', { error: metadataError.message, path: itemPath });
          }
          return;
        }

        if (stat.isDirectory() && !item.startsWith('.')) {
          searchForMetadataFile(itemPath);
          if (zipMetadata) return;
        }
      }
    }

    searchForMetadataFile(extractionDir);

    let candidateFile = null;
    let fileContent = null;
    let fileType = null;

    // Recursive function to search for CSV or JSON files
    function searchForDataFile(dirPath) {
      if (candidateFile) return; // Already found
      
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isFile()) {
          if (item.toLowerCase().endsWith('.csv')) {
            candidateFile = itemPath;
            fileType = 'CSV';
            logger.info('Found CSV file in ZIP', { fileName: item, path: itemPath });
            return;
          } else if (item.toLowerCase().endsWith('.json') && item.toLowerCase() !== 'metadata.json') {
            candidateFile = itemPath;
            fileType = 'JSON';
            logger.info('Found JSON file in ZIP', { fileName: item, path: itemPath });
            return;
          }
        } else if (stat.isDirectory() && !item.startsWith('.')) {
          // Recursively search subdirectories
          searchForDataFile(itemPath);
        }
      }
    }

    // Start recursive search
    searchForDataFile(extractionDir);

    if (!candidateFile) {
      throw new Error('No CSV or JSON file found in the ZIP archive');
    }

    // Copy candidate metafile (CSV/JSON) to uploads/candidates-data for raw audit
    try {
      const rawCandidateFileDir = path.join(uploadBaseDir, 'candidates-data');
      if (!fs.existsSync(rawCandidateFileDir)) {
        fs.mkdirSync(rawCandidateFileDir, { recursive: true });
      }
      const rawCandidateFileDest = path.join(rawCandidateFileDir, path.basename(candidateFile));
      fs.copyFileSync(candidateFile, rawCandidateFileDest);
      logger.info('Copied candidate data file to uploads candidates-data store', {
        source: candidateFile,
        destination: rawCandidateFileDest
      });
    } catch (copyErr) {
      logger.warn('Failed to copy candidate data file to uploads directory', { error: copyErr.message });
    }

    // Read the extracted file
    fileContent = fs.readFileSync(candidateFile, 'utf8');
    
    logger.info('File content from ZIP extracted', { 
      length: fileContent.length,
      firstChars: fileContent.substring(0, 200),
      fileType: fileType
    });

    // Process similar to processCandidateFile
    const candidatesModule = require('./candidates');
    const existingCandidates = candidatesModule.getCandidates() || [];
    const existingCandidateMap = new Map(existingCandidates.map(c => [
      (c.hallTicket || c.id || '').toString(),
      c
    ]));

    // merge-specific metadata
    const uploadedCandidateKeys = new Set();

    if (uploadMode === 'replace') {
      candidatesModule.clearCandidates();
    }

    const failedCandidates = [];
    let successCount = 0;

    // Use stored centre info from candidates module if available.
    // Do NOT fall back to any hard-coded/mock centre defaults here.
    let centreInfo = candidatesModule.getCentreInfo() || { centreCode: '', centreName: '', cityName: '', examSlot: '' };
    const tokenCentreInfo = getCentreInfoFromRequestAuth(req);
    if (tokenCentreInfo) {
      centreInfo.centreCode = centreInfo.centreCode || tokenCentreInfo.code;
      centreInfo.centreName = centreInfo.centreName || tokenCentreInfo.name;
      centreInfo.cityName = centreInfo.cityName || tokenCentreInfo.city;
    }

    if (zipMetadata && typeof zipMetadata === 'object') {
      centreInfo.centreCode = centreInfo.centreCode || String(zipMetadata.centreCode || '').trim();
      centreInfo.centreName = centreInfo.centreName || String(zipMetadata.centreName || '').trim();
      centreInfo.cityName = centreInfo.cityName || String(zipMetadata.cityName || zipMetadata.city || '').trim();
      centreInfo.examSlot = centreInfo.examSlot || String(zipMetadata.examSlot || '').trim();
      
      // Update candidate counts if available in metadata
      if (zipMetadata.candidateCount) {
        centreInfo.candidate_counts = {
          total: zipMetadata.candidateCount,
          completed: 0,
          pending: zipMetadata.candidateCount
        };
      }
    }

    let candidates = [];

    // Parse the extracted file
    if (fileType === 'CSV') {
      logger.info('Parsing CSV from ZIP');
      try {
        candidates = parseCSV(fileContent);
        logger.success('CSV from ZIP parsed successfully', { 
          candidatesCount: candidates.length
        });
      } catch (parseError) {
        logger.error('CSV parse error', { error: parseError.message });
        throw new Error(`CSV parsing failed: ${parseError.message}`);
      }
    } else if (fileType === 'JSON') {
      logger.info('Parsing JSON from ZIP');
      try {
        let jsonData = JSON.parse(fileContent);
        
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          jsonData = jsonData[0];
        }
        
        logger.info('JSON from ZIP parsed successfully', { 
          topLevelKeys: Object.keys(jsonData),
          candidatesCount: jsonData.centre?.candidates?.length || 0
        });

        if (!jsonData.centre) {
          throw new Error('Invalid JSON format: Missing "centre" property');
        }
        
        if (!jsonData.centre.candidates) {
          throw new Error('Invalid JSON format: Missing "candidates" array');
        }
        
        if (!Array.isArray(jsonData.centre.candidates)) {
          throw new Error('Invalid JSON format: "candidates" must be an array');
        }

        if (jsonData.centre && jsonData.centre.code) {
          centreInfo.code = jsonData.centre.code;
          centreInfo.name = jsonData.centre.name || centreInfo.name || '';
          centreInfo.cityName = jsonData.centre.city || jsonData.centre.cityName || centreInfo.cityName || '';
          centreInfo.examSlot = jsonData.centre.examSlot || centreInfo.examSlot || '';
        } else if (!centreInfo || !centreInfo.code) {
          throw new Error('Centre information missing in uploaded JSON and no stored centre assigned. Please login to assign a centre or include centre metadata in the upload.');
        }
        
        candidates = jsonData.centre.candidates;
      } catch (parseError) {
        logger.error('JSON parse error', { error: parseError.message });
        throw new Error(`JSON parsing failed: ${parseError.message}`);
      }
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        successful: false,
        message: 'No candidates found in extracted file'
      });
    }

    const firstCandidateWithCity = candidates.find((candidate) =>
      resolveCandidateCity(candidate, '').trim().length > 0
    );
    if (firstCandidateWithCity) {
      centreInfo.cityName = resolveCandidateCity(firstCandidateWithCity, '').trim();
    }

    const firstCandidateWithCentreCode = candidates.find((candidate) =>
      resolveCandidateCentreCode(candidate, '').trim().length > 0
    );
    if (firstCandidateWithCentreCode) {
      centreInfo.code = resolveCandidateCentreCode(firstCandidateWithCentreCode, '').trim();
    }

    const firstCandidateWithExamSlot = candidates.find((candidate) =>
      resolveCandidateExamSlot(candidate, '').trim().length > 0
    );
    if (firstCandidateWithExamSlot) {
      centreInfo.examSlot = resolveCandidateExamSlot(firstCandidateWithExamSlot, '').trim();
    }

    if ((!centreInfo || !String(centreInfo.code || '').trim()) && tokenCentreInfo?.code) {
      centreInfo.code = tokenCentreInfo.code;
      centreInfo.name = centreInfo.name || tokenCentreInfo.name || '';
      centreInfo.cityName = centreInfo.cityName || tokenCentreInfo.city || '';
    }

    if (!centreInfo || !String(centreInfo.code || '').trim()) {
      return res.status(400).json({
        successful: false,
        message: 'Centre information not available in uploaded data. Please ensure ZIP CSV contains Centre Code/Centre Name/City/Exam Slot metadata.'
      });
    }

    const firstCandidateWithCentreName = candidates.find((candidate) =>
      resolveCandidateCentreName(candidate, '').trim().length > 0
    );
    const inferredCentreName = firstCandidateWithCentreName
      ? resolveCandidateCentreName(firstCandidateWithCentreName, '')
      : '';

    const centreNameEqualsCity =
      String(centreInfo.name || '').trim().toLowerCase() !== '' &&
      String(centreInfo.name || '').trim().toLowerCase() === String(centreInfo.cityName || '').trim().toLowerCase();

    if (inferredCentreName && (!centreInfo.name || centreNameEqualsCity)) {
      centreInfo.name = inferredCentreName;
    }

    // Update centre info
    candidatesModule.setCentreInfo(centreInfo);

    // Helper function to copy image from ZIP to data folder
    function copyImageFromZIP(relativePath, extractionDir, candidateId, imageType) {
      try {
        if (!relativePath) return null;
        
        const sourceFile = path.join(extractionDir, relativePath);
        
        if (!fs.existsSync(sourceFile)) {
          logger.warn(`Image file not found in ZIP: ${relativePath}`);
          return null;
        }
        
        const appDataDir = path.join(__dirname, '../../data');
        const destDir = path.join(appDataDir, 'candidates-data', candidateId);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        const ext = path.extname(sourceFile);
        // Map imageType to proper filename
        const fileNameMap = {
          photo: 'photo',
          signature: 'signature'
        };
        const destFileName = `${fileNameMap[imageType] || imageType}${ext}`;
        const destFile = path.join(destDir, destFileName);
        fs.copyFileSync(sourceFile, destFile);
        
        logger.info(`Image copied from ZIP: ${relativePath} → ${destFileName}`);
        return `/data/candidates-data/${candidateId}/${destFileName}`;
      } catch (err) {
        logger.warn(`Failed to copy image from ZIP: ${relativePath}`, { error: err.message });
        return null;
      }
    }

    // Process each candidate
    candidates.forEach((candidate, index) => {
      try {
        // Support multiple field name formats (JSON vs CSV)
        const candidateId = candidate.candidateId || 
                           candidate.applicationNumber || 
                           candidate['Application Number'] ||
                           candidate['application_number'];
        
        const candidateName = candidate.candidateName || 
                             candidate.fullName || 
                             candidate['Full Name'] ||
                             candidate['full_name'];

        if (!candidateId || !candidateName) {
          throw new Error('Missing candidateId/applicationNumber or candidateName/fullName');
        }

        const hallTicket = resolveCandidateHallTicket(candidate, centreInfo.examSlot);
        if (!hallTicket) {
          throw new Error('Missing hall ticket for candidate');
        }

        const candidateKey = (hallTicket || candidateId).toString();
        uploadedCandidateKeys.add(candidateKey);

        // Merge mode: skip candidate if already exists (preserve existing biometric data)
        if (uploadMode === 'merge' && existingCandidateMap.has(candidateKey)) {
          logger.info('Skipping existing candidate in merge mode', {
            candidateId: existingCandidateMap.get(candidateKey).id,
            hallTicket: existingCandidateMap.get(candidateKey).hallTicket
          });
          return;
        }

        // Automatically find images in ZIP based on candidate ID
        // Look for photos/{candidateId}.jpg and signatures/{candidateId}.jpg
        let uploadedImagePath = null;
        let liveImagePath = null;
        
        // Try to find photo image (prefer explicit path from CSV)
        const photoFileFromRow = String(candidate['Photo File'] || candidate.photoFile || '').trim();
        let photoFilePath = photoFileFromRow.replace(/^\/+/, '');
        if (!photoFilePath) {
          const photoFileName = `${candidateId}.jpg`;
          photoFilePath = `photos/${photoFileName}`;
        }
        if (fs.existsSync(path.join(extractionDir, photoFilePath))) {
          uploadedImagePath = copyImageFromZIP(photoFilePath, extractionDir, candidateId, 'photo');
        }
        
        // Try to find signature image (prefer explicit path from CSV)
        const signatureFileFromRow = String(candidate['Signature File'] || candidate.signatureFile || '').trim();
        let signatureFilePath = signatureFileFromRow.replace(/^\/+/, '');
        if (!signatureFilePath) {
          const fallbackPhotoFileName = `${candidateId}.jpg`;
          signatureFilePath = `signatures/${fallbackPhotoFileName}`;
        }
        if (fs.existsSync(path.join(extractionDir, signatureFilePath))) {
          liveImagePath = copyImageFromZIP(signatureFilePath, extractionDir, candidateId, 'signature');
        }

        const resolvedCandidateCentreCode = centreInfo.code || resolveCandidateCentreCode(candidate, centreInfo.code);
        const resolvedCandidateExamSlot = centreInfo.examSlot || resolveCandidateExamSlot(candidate, centreInfo.examSlot);
        const resolvedCentreName = centreInfo.name || resolveCandidateCentreName(candidate, centreInfo.name);
        const resolvedCandidateCity = centreInfo.cityName || resolveCandidateCity(candidate, centreInfo.cityNamecityName);
        const candidateObj = {
          id: candidateId,
          hallTicket: hallTicket,
          candidateName: candidateName,
          emailId: candidate.emailId || candidate.email || `${candidateName.toLowerCase().replace(/\s+/g, '')}@example.com`,
          gender: (candidate.gender || candidate.Gender || 'other').toLowerCase(),
          image: '',  // For base64 image data (from JSON uploads)
          liveImage: '',  // For base64 signature data (from JSON uploads)
          userExamApplicationId: candidate.userExamApplicationId || candidate['Application Number'] || candidateId || '',
          // Biometric tracking
          faceStatus: 'Pending',
          thumbStatus: 'Pending',
          biometricStatus: 'Pending',
          faceCaptureData: null,
          thumbCaptureData: null,
          // Cloud sync tracking
          syncedToCloud: false,
          syncedAt: null,
          syncError: null,
          cloudId: null,
          // Image paths (automatically detected from ZIP folders)
          uploadedImagePath: uploadedImagePath,
          liveImagePath: liveImagePath,
          capturedImagePath: null,
          biometricImagePath: null,
          // Centre details
          centreCode: resolvedCandidateCentreCode,
          centreName: resolvedCentreName,
          city: resolvedCandidateCity,
          examSlot: resolvedCandidateExamSlot,
          // Timestamps
          imageCaptureTimestamp: null,
          thumbCaptureTimestamp: null,
          submitTimestamp: null
        };

        candidatesModule.addCandidate(candidateObj);
        successCount++;
        
        logger.info(`Candidate ${index + 1} from ZIP processed successfully`, {
          candidateId: candidateObj.id,
          hallTicket: candidateObj.hallTicket
        });
      } catch (err) {
        logger.error(`Failed to process candidate ${index + 1} from ZIP`, {
          error: err.message,
          candidateId: candidate.candidateId || candidate.applicationNumber
        });
        failedCandidates.push(`Candidate ${index + 1}: ${err.message}`);
      }
    });

    // For merge mode, clean-up candidates that are no longer in the uploaded file
    if (uploadMode === 'merge') {
      await candidatesModule.retainCandidatesByKeySet(uploadedCandidateKeys);
    }

    logger.success('Candidate ZIP file processed', {
      fileName: file.originalname,
      totalCandidates: candidates.length,
      successful: successCount,
      failed: failedCandidates.length,
      centreCode: centreInfo.code,
      ip: req.ip
    });

    // Save all data to disk
    try {
      await candidatesModule.saveToDisk();
      logger.info('All candidate data from ZIP saved to disk');
    } catch (saveError) {
      logger.warn('Failed to save candidate data after ZIP processing', {
        error: saveError.message
      });
    }

    // Cleanup extraction directory (we don't keep per-upload folder state now)
    try {
      if (fs.existsSync(extractionDir)) {
        fs.rmSync(extractionDir, { recursive: true, force: true });
        logger.info('Cleaned extraction directory after processing', { extractionDir });
      }
    } catch (cleanupError) {
      logger.warn('Failed to cleanup extraction directory', { error: cleanupError.message });
    }

    // Return response
    if (failedCandidates.length > 0) {
      const errorMessage = failedCandidates.length === candidates.length 
        ? 'All candidates failed to process' 
        : `${failedCandidates.length} candidates failed to process`;

      return res.json({
        successful: false,
        message: errorMessage,
        error: failedCandidates.join(' | '),
        centreInfo: centreInfo,
        successCount: successCount
      });
    }

    res.json({
      successful: true,
      message: `Successfully processed ${successCount} candidates from ZIP`,
      data: {
        processedCount: candidates.length,
        successfulCount: successCount,
        failedCount: failedCandidates.length,
        centreInfo: centreInfo
      }
    });

  } catch (error) {
    logger.error('Error processing ZIP file', {
      error: error.message,
      fileName: file.originalname,
      ip: req.ip
    });

    // Clean up temporary upload file (keep extraction for debugging/audit)
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (cleanupError) {
      logger.warn('Failed to cleanup after error', { error: cleanupError.message });
    }

    res.status(400).json({
      successful: false,
      message: 'Error processing ZIP file.',
      error: error.message
    });
  }
}

// Process biometric image
function processBiometricImage(req, res, file, hallTicket, matchPercentage) {
  try {
    logger.info('Processing biometric image', {
      fileName: file.originalname,
      fileSize: file.size,
      hallTicket,
      matchPercentage,
      ip: req.ip
    });

    if (!hallTicket) {
      return res.status(400).json({
        successful: false,
        message: 'Hall ticket is required for image upload'
      });
    }

    // Mock image processing and storage
    const imageData = {
      hallTicket,
      fileName: file.originalname,
      fileSize: file.size,
      matchPercentage: parseFloat(matchPercentage) || 0,
      uploadedAt: new Date().toISOString(),
      filePath: file.path
    };

    logger.success('Biometric image processed successfully', {
      hallTicket,
      fileName: file.originalname,
      matchPercentage,
      ip: req.ip
    });

    res.json({
      successful: true,
      message: 'Image uploaded and processed successfully',
      data: imageData
    });

  } catch (error) {
    logger.error('Error processing biometric image', {
      error: error.message,
      fileName: file.originalname,
      hallTicket,
      ip: req.ip
    });

    // Clean up uploaded file on error
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.status(500).json({
      successful: false,
      message: 'Error processing image'
    });
  }
}

// Reset all system data (delete candidates, images, but keep logs)
router.post('/reset-system', async (req, res) => {
  try {
    logger.info('System reset requested', { ip: req.ip });

    const candidatesModule = require('./candidates');
    const dataStore = require('../utils/dataStore');
    
    // Get current centre info to know which folders to delete
    const centreInfo = candidatesModule.getCentreInfo();
    const candidates = candidatesModule.getCandidates();
    
    // Delete all uploaded images
    const uploadsDir = path.join(__dirname, '../../uploads');
    let deletedFolders = 0;
    let deletedFiles = 0;
    
    // Function to recursively delete directory contents except logs
    const deleteDirectory = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        const items = fs.readdirSync(dirPath);
        items.forEach(item => {
          const itemPath = path.join(dirPath, item);
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            deleteDirectory(itemPath);
            fs.rmdirSync(itemPath);
            deletedFolders++;
          } else {
            fs.unlinkSync(itemPath);
            deletedFiles++;
          }
        });
      }
    };
    
    // Delete all uploads (files and directories) except keep .gitkeep
    if (fs.existsSync(uploadsDir)) {
      const items = fs.readdirSync(uploadsDir);
      for (const item of items) {
        if (item === '.gitkeep') continue;
        const itemPath = path.join(uploadsDir, item);
        try {
          const stats = fs.statSync(itemPath);
          if (stats.isDirectory()) {
            deleteDirectory(itemPath);
            // Remove the now-empty directory
            fs.rmdirSync(itemPath);
            deletedFolders++;
          } else {
            // Remove files (zip, temp files)
            fs.unlinkSync(itemPath);
            deletedFiles++;
          }
        } catch (err) {
          logger.warn('Failed to remove upload item during reset', { item, error: err.message });
        }
      }
    }
    
    // Clear all candidate data (in-memory) and centre info for a full reset
    candidatesModule.clearCandidates();
    candidatesModule.setCentreInfo({ code: '', name: '', examSlot: '' });

    // Delete all app data files from /data
    const dataDir = path.join(__dirname, '../../data');
    const filesToDelete = ['candidates.json', 'centreInfo.json', 'candidate_biometric_details.json'];

    for (const fileName of filesToDelete) {
      const filePath = path.join(dataDir, fileName);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`Deleted data file: ${fileName}`);
        }
      } catch (err) {
        logger.warn('Failed to delete data file during reset', { fileName, error: err.message });
      }
    }

    // Delete candidate image folders under /data/candidates-data
    const dataCandidatesDir = path.join(dataDir, 'candidates-data');

    try {
      if (fs.existsSync(dataCandidatesDir)) {
        deleteDirectory(dataCandidatesDir);
        fs.rmdirSync(dataCandidatesDir);
        logger.info('Deleted data candidates-data folder');
      }
    } catch (err) {
      logger.warn('Failed to delete data candidates-data directory during reset', { error: err.message });
    }

    // Also remove legacy biometric JSON path in uploads if exists
    const legacyBioPath = path.join(__dirname, '../../uploads/candidates-data/candidates_biometric.json');
    try {
      if (fs.existsSync(legacyBioPath)) {
        fs.unlinkSync(legacyBioPath);
        logger.info('Deleted legacy biometric JSON file from uploads');
      }
    } catch (err) {
      logger.warn('Failed to delete legacy biometric JSON during reset', { error: err.message });
    }

    // Ensure disk reflects cleared in-memory state
    try {
      await candidatesModule.saveToDisk();
      logger.info('Saved cleared candidate data to disk');
    } catch (err) {
      logger.warn('Failed to save cleared data to disk', { error: err.message });
    }
    
    logger.success('System reset completed successfully', {
      deletedFolders,
      deletedFiles,
      candidatesCleared: candidates.length,
      ip: req.ip
    });
    
    res.json({
      successful: true,
      message: 'System reset completed successfully. All candidate data and images have been deleted.',
      data: {
        deletedFolders,
        deletedFiles,
        candidatesCleared: candidates.length
      }
    });
    
  } catch (error) {
    logger.error('Error resetting system', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    
    res.status(500).json({
      successful: false,
      message: 'Error resetting system. Please try again.',
      error: error.message
    });
  }
});

// Serve candidate images (photos, signatures) from data folder (legacy route)
router.get('/images/:candidateId/:fileName', (req, res) => {
  try {
    const { candidateId, fileName } = req.params;
    
    // Security: validate file name to prevent directory traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({
        successful: false,
        message: 'Invalid file name'
      });
    }
    
    const filePath = path.join(__dirname, '../../data/candidates-data', candidateId, fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.warn('Image file not found in data folder', { candidateId, fileName, filePath });
      return res.status(404).json({
        successful: false,
        message: 'Image not found'
      });
    }
    
    // Get file stats
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return res.status(400).json({
        successful: false,
        message: 'Invalid file'
      });
    }
    
    // Serve file
    const ext = path.extname(fileName).toLowerCase();
    let contentType = 'image/jpeg';
    
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.bmp') contentType = 'image/bmp';
    else if (ext === '.webp') contentType = 'image/webp';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    
    logger.info('Image served', { candidateId, fileName });
  } catch (error) {
    logger.error('Error serving image', {
      error: error.message,
      candidateId: req.params.candidateId,
      fileName: req.params.fileName
    });
    
    res.status(500).json({
      successful: false,
      message: 'Error serving image'
    });
  }
});

module.exports = router;
