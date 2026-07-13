const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const imageStorage = require('../utils/imageStorage');

// Mock lab data (replace with database in production)
const labs = [
  {
    labId: 1,
    labName: 'Computer Lab 1',
    capacity: 30,
    availableSystems: 25,
    systems: [
      { systemNo: 1, allocated: false, hallTicket: null },
      { systemNo: 2, allocated: true, hallTicket: 'HT001' },
      { systemNo: 3, allocated: false, hallTicket: null }
    ]
  },
  {
    labId: 2,
    labName: 'Computer Lab 2',
    capacity: 25,
    availableSystems: 20,
    systems: [
      { systemNo: 1, allocated: false, hallTicket: null },
      { systemNo: 2, allocated: false, hallTicket: null }
    ]
  }
];

const allocatedSeats = new Map();

// IMPORTANT: Specific routes MUST come before parameterized routes like /:hallTicket
// Otherwise Express will match the path as a parameter

// Get lab details
router.get('/client-registration-lab', (req, res) => {
  try {
    logger.info('Fetching lab details', { ip: req.ip });

    res.json({
      successful: true,
      data: labs.map(lab => ({
        labId: lab.labId,
        labName: lab.labName,
        capacity: lab.capacity,
        availableSystems: lab.availableSystems
      }))
    });

  } catch (error) {
    logger.error('Error fetching lab details', {
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

// Get all candidates list with biometric status - MUST be before /:hallTicket route
router.get('/view-generated-hall-ticket-list', (req, res) => {
  try {
    const { examId, examSlot } = req.query;
    
    logger.info('Fetching candidates list', { examId, examSlot, ip: req.ip });

    // Get candidates from the candidates module
    const candidatesModule = require('./candidates');
    const candidates = candidatesModule.getCandidates();

    // Return all candidates with their biometric status
    const candidatesList = candidates.map(candidate => ({
      candidateId: candidate.id,
      candidateName: candidate.candidateName,
      hallTicket: candidate.hallTicket,
      emailId: candidate.emailId,
      phone: candidate.phone,
      gender: candidate.gender,
      // Biometric statuses
      faceStatus: candidate.faceStatus || 'Pending',
      thumbStatus: candidate.thumbStatus || 'Pending',
      biometricStatus: candidate.biometricStatus || 'Pending',
      matchPercentage: candidate.matchPercentage || null,
      // Centre details
      centreCode: candidate.centreCode,
      centreName: candidate.centreName,
      examSlot: candidate.examSlot,
      examId: candidate.examId,
      userExamApplicationId: candidate.userExamApplicationId,
      // Image paths
      uploadedImagePath: candidate.uploadedImagePath || null,
      liveImagePath: candidate.liveImagePath || null,
      biometricImagePath: candidate.biometricImagePath ? `/uploads/${candidate.biometricImagePath}` : null,
      // Timestamps
      thumbCaptureTimestamp: candidate.thumbCaptureTimestamp || null,
      submitTimestamp: candidate.submitTimestamp || null
    }));

    res.json(candidatesList);

  } catch (error) {
    logger.error('Error fetching candidates list', {
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

// Lab allocation routes removed - not needed for simplified biometric system

// Submit biometric - marks candidate as biometric completed
router.post('/v2/allocate/seat/:hallTicket', async (req, res) => {
  try {
    const { hallTicket } = req.params;
    
    logger.info('Submitting biometric for candidate', { hallTicket, ip: req.ip });

    // Get candidate
    const candidatesModule = require('./candidates');
    const candidates = candidatesModule.getCandidates();
    const candidate = candidates.find(c => c.hallTicket === hallTicket);

    if (!candidate) {
      return res.status(404).json({
        successful: false,
        message: 'Candidate not found'
      });
    }

    // Check if both face and thumb are captured
    if (candidate.faceStatus !== 'Completed' || candidate.thumbStatus !== 'Completed') {
      return res.status(400).json({
        successful: false,
        message: 'Please complete both face and fingerprint capture before submitting'
      });
    }

    // Mark as biometric completed and add submit timestamp
    candidate.biometricStatus = 'Completed';
    candidate.submitTimestamp = new Date().toISOString();
    
    // Save to disk (saves to all 3 JSON files)
    await candidatesModule.saveToDisk();
    
    logger.success('Biometric submission completed', { 
      hallTicket, 
      candidateId: candidate.id,
      submitTimestamp: candidate.submitTimestamp
    });

    res.json({
      successful: true,
      message: 'Biometric submission successful',
      data: {
        candidateId: candidate.id,
        candidateName: candidate.candidateName,
        hallTicket: candidate.hallTicket,
        submitTimestamp: candidate.submitTimestamp
      }
    });

  } catch (error) {
    logger.error('Error submitting biometric', {
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

// Reset biometric data for candidate
router.post('/deallocate/seat/:hallTicket', async (req, res) => {
  try {
    const { hallTicket } = req.params;
    
    logger.info('Resetting biometric for candidate', { hallTicket, ip: req.ip });

    // Get candidate
    const candidatesModule = require('./candidates');
    const candidates = candidatesModule.getCandidates();
    const candidate = candidates.find(c => c.hallTicket === hallTicket);

    if (!candidate) {
      return res.status(404).json({
        successful: false,
        message: 'Candidate not found'
      });
    }

    // Delete captured and biometric images (keep uploaded and live images)
    try {
      const fs = require('fs');
      const path = require('path');
      const candidateDir = imageStorage.getCandidateDirectory(hallTicket);
      
      // Delete only captured and biometric images
      const filesToDelete = ['captured.png', 'captured.jpg', 'captured.bmp', 'biometric.png', 'biometric.jpg', 'biometric.bmp'];
      filesToDelete.forEach(file => {
        const filePath = path.join(candidateDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info('Deleted image file', { hallTicket, file });
        }
      });
    } catch (err) {
      logger.warn('Error deleting images', { hallTicket, error: err.message });
    }
    
    // Reset biometric data
    candidate.faceCaptureData = null;
    candidate.thumbCaptureData = null;
    candidate.capturedImagePath = null;
    candidate.biometricImagePath = null;
    candidate.faceStatus = 'Pending';
    candidate.thumbStatus = 'Pending';
    candidate.biometricStatus = 'Pending';
    candidate.matchPercentage = null;
    
    // Reset timestamps
    candidate.imageCaptureTimestamp = null;
    candidate.thumbCaptureTimestamp = null;
    candidate.submitTimestamp = null;
    
    // Save to disk (saves to all 3 JSON files)
    await candidatesModule.saveToDisk();

    logger.success('Biometric data reset successfully', { hallTicket });

    res.json({
      successful: true,
      message: 'Biometric data reset successfully'
    });

  } catch (error) {
    logger.error('Error resetting biometric', {
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

// Export JSON data
router.get('/export-json', (req, res) => {
  try {
    const { examId, examSlot } = req.query;
    
    logger.info('Exporting JSON data', { examId, examSlot, ip: req.ip });

    // Mock export data
    const exportData = {
      examId: examId,
      examSlot: examSlot,
      exportDate: new Date().toISOString(),
      data: Array.from(allocatedSeats.values())
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="biometric_data.json.enc"');
    
    // Mock encrypted content (in real app, encrypt the data)
    const encryptedContent = Buffer.from(JSON.stringify(exportData, null, 2));
    
    res.send(encryptedContent);

  } catch (error) {
    logger.error('Error exporting JSON data', {
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

// Get candidate seating details count (for lab-details route)
router.get('/candidate-seating-details', (req, res) => {
  try {
    const { examId, examSlot } = req.query;
    
    logger.info('Fetching biometric completed count', { examId, examSlot, ip: req.ip });

    // Get candidates from candidates module
    const candidatesModule = require('./candidates');
    const candidates = candidatesModule.getCandidates();
    
    // Count candidates with biometricStatus = 'Completed'
    const completedCount = candidates.filter(c => c.biometricStatus === 'Completed').length;

    logger.info('Biometric completed count retrieved', { completedCount });

    res.json({
      successful: true,
      allocatedCount: completedCount,  // Keep same field name for frontend compatibility
      completedCount: completedCount,
      examId: examId,
      examSlot: examSlot
    });

  } catch (error) {
    logger.error('Error fetching candidate seating details count', {
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
