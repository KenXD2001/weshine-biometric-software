const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

/**
 * Sanitize folder name by removing/replacing invalid characters for Windows/Unix
 * Windows doesn't allow: < > : " / \ | ? *
 * Replace : with - and spaces with _
 */
function sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')  // Replace invalid chars with dash
    .replace(/\s+/g, '_')            // Replace spaces with underscore
    .replace(/-+/g, '-')             // Replace multiple dashes with single dash
    .trim();
}

/**
 * Create candidate directory if it doesn't exist
 * @param {string} hallTicket - Candidate hall ticket
 * @returns {string} - Absolute path to created directory
 */
function createCandidateDirectory(hallTicket) {
  try {
    const candidateDir = getCandidateDirectory(hallTicket);
    
    if (!fs.existsSync(candidateDir)) {
      fs.mkdirSync(candidateDir, { recursive: true });
      logger.info('Created candidate directory', { candidateDir, hallTicket });
    }
    
    return candidateDir;
  } catch (error) {
    logger.error('Failed to create candidate directory', { 
      error: error.message, 
      hallTicket 
    });
    throw error;
  }
}

/**
 * Convert base64 string to image file
 * @param {string} base64String - Base64 encoded image (with or without data URI prefix)
 * @param {string} hallTicket - Candidate hall ticket
 * @param {string} imageType - Type of image (uploaded, live, captured, biometric)
 * @param {string} centreCode - Centre code (optional, will be fetched if not provided)
 * @returns {string} - Relative path to saved image
 */
function saveBase64Image(base64String, hallTicket, imageType, centreCode) {
  try {
    if (!base64String) {
      throw new Error('Base64 string is required');
    }

    // Get centre code if not provided
    if (!centreCode) {
      const candidatesModule = require('../routes/candidates');
      const centreInfo = candidatesModule.getCentreInfo();
      centreCode = centreCode || centreInfo.code || 'UNKNOWN';
    }

    // Remove data URI prefix if present (e.g., "data:image/png;base64,")
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Create candidate directory
    const candidateDir = createCandidateDirectory(hallTicket);
    
    // Determine file extension based on image type or detect from base64
    let extension = 'png'; // default
    if (base64String.includes('data:image/jpeg') || base64String.includes('data:image/jpg')) {
      extension = 'jpg';
    } else if (base64String.includes('data:image/bmp')) {
      extension = 'bmp';
    }
    
    // Create filename: {imageType}.{extension}
    const filename = `${imageType}.${extension}`;
    const filePath = path.join(candidateDir, filename);
    
    // Save image to disk
    fs.writeFileSync(filePath, imageBuffer);
    
    // Return relative path from uploads folder (simplified structure)
    const sanitizedHallTicket = sanitizeFolderName(hallTicket);
    const relativePath = `candidates-data/${sanitizedHallTicket}/${filename}`;
    
    logger.info('Saved base64 image', {
      hallTicket: sanitizedHallTicket,
      imageType,
      filename,
      size: imageBuffer.length,
      relativePath
    });
    
    return relativePath;

  } catch (error) {
    logger.error('Error saving base64 image', {
      error: error.message,
      hallTicket,
      imageType
    });
    throw error;
  }
}

/**
 * Get candidate directory path
 */
function getCandidateDirectory(hallTicket) {
  // Use proper upload directory path like multer configuration
  let uploadBaseDir;
  if (process.env.NODE_ENV === 'production' && process.resourcesPath) {
    // In packaged Electron, use resources/uploads (outside asar)
    uploadBaseDir = path.join(process.resourcesPath, 'uploads');
  } else {
    // In dev, use project uploads folder
    uploadBaseDir = path.join(__dirname, '../../uploads');
  }
  
  const sanitizedHallTicket = sanitizeFolderName(hallTicket);
  return path.join(uploadBaseDir, 'candidates-data', sanitizedHallTicket);
}

/**
 * Delete candidate directory and all images
 */
function deleteCandidateImages(hallTicket) {
  try {
    const candidateDir = getCandidateDirectory(hallTicket);
    
    if (fs.existsSync(candidateDir)) {
      // Delete all files in directory
      const files = fs.readdirSync(candidateDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(candidateDir, file));
      });
      
      // Delete directory
      fs.rmdirSync(candidateDir);
      
      logger.info('Deleted candidate images', {
        hallTicket,
        filesDeleted: files.length
      });
      
      return true;
    }
    
    return false;
    
  } catch (error) {
    logger.error('Error deleting candidate images', {
      error: error.message,
      hallTicket
    });
    throw error;
  }
}

/**
 * Check if candidate has images stored
 */
function candidateHasImages(hallTicket) {
  const candidateDir = getCandidateDirectory(hallTicket);
  return fs.existsSync(candidateDir);
}

/**
 * Get list of all images for a candidate
 */
function getCandidateImages(hallTicket) {
  try {
    const candidateDir = getCandidateDirectory(hallTicket);
    
    if (!fs.existsSync(candidateDir)) {
      return [];
    }
    
    const files = fs.readdirSync(candidateDir);
    
    // Sanitize folder name for path
    const sanitizedHallTicket = sanitizeFolderName(hallTicket);
    
    return files.map(file => ({
      filename: file,
      path: `candidates-data/${sanitizedHallTicket}/${file}`,
      fullPath: path.join(candidateDir, file),
      size: fs.statSync(path.join(candidateDir, file)).size
    }));
    
  } catch (error) {
    logger.error('Error getting candidate images', {
      error: error.message,
      hallTicket
    });
    return [];
  }
}

/**
 * Save multiple candidate images
 * @param {Object} imageData - Object containing image data
 * @param {string} centreCode - Centre code
 * @returns {Array} - Array of saved file paths
 */
function saveCandidateImages(imageData, centreCode) {
  try {
    const savedPaths = [];
    
    // Save each image type if present
    if (imageData.uploadedImage) {
      const path = saveBase64Image(imageData.uploadedImage, imageData.hallTicket, 'uploaded', centreCode);
      savedPaths.push(path);
    }
    
    if (imageData.liveImage) {
      const path = saveBase64Image(imageData.liveImage, imageData.hallTicket, 'live', centreCode);
      savedPaths.push(path);
    }
    
    if (imageData.capturedImage) {
      const path = saveBase64Image(imageData.capturedImage, imageData.hallTicket, 'captured', centreCode);
      savedPaths.push(path);
    }
    
    if (imageData.biometricImage) {
      const path = saveBase64Image(imageData.biometricImage, imageData.hallTicket, 'biometric', centreCode);
      savedPaths.push(path);
    }
    
    return savedPaths;
  } catch (error) {
    logger.error('Error saving candidate images', {
      error: error.message,
      hallTicket: imageData.hallTicket
    });
    throw error;
  }
}

module.exports = {
  createCandidateDirectory,
  saveBase64Image,
  saveCandidateImages,
  getCandidateDirectory,
  deleteCandidateImages,
  candidateHasImages,
  getCandidateImages
};

