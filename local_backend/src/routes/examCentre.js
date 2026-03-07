const express = require('express');
const router = express.Router();
const logger = require('../config/logger');

// Mock exam centre data (replace with database in production)
const examCentres = [
  {
    examId: 1,
    centreCode: 'CENTRE001',
    centreName: 'Delhi Examination Centre',
    examDate: ['2024-01-15', '2024-01-16', '2024-01-17'],
    sessions: ['Slot1', 'Slot2', 'Slot3']
  },
  {
    examId: 2,
    centreCode: 'CENTRE002',
    centreName: 'Mumbai Examination Centre',
    examDate: ['2024-01-15', '2024-01-16'],
    sessions: ['Slot1', 'Slot2']
  },
  {
    examId: 3,
    centreCode: 'CENTRE003',
    centreName: 'Bangalore Examination Centre',
    examDate: ['2024-01-15'],
    sessions: ['Slot1']
  }
];

// Get exam centre details by code
router.get('/:centreCode', (req, res) => {
  try {
    const { centreCode } = req.params;
    
    logger.info('Fetching exam centre details', { centreCode, ip: req.ip });

    const centre = examCentres.find(c => c.centreCode === centreCode);
    
    if (!centre) {
      logger.warn('Exam centre not found', { centreCode, ip: req.ip });
      return res.status(404).json({
        successful: false,
        message: 'Exam centre not found'
      });
    }

    logger.success('Exam centre details retrieved', { 
      centreCode, 
      centreName: centre.centreName,
      examId: centre.examId 
    });

    res.json({
      successful: true,
      data: {
        examId: centre.examId,
        centreCode: centre.centreCode,
        centreName: centre.centreName,
        examDate: centre.examDate,
        sessions: centre.sessions
      }
    });

  } catch (error) {
    logger.error('Error fetching exam centre details', {
      error: error.message,
      stack: error.stack,
      centreCode: req.params.centreCode,
      ip: req.ip
    });
    res.status(500).json({
      successful: false,
      message: 'Internal server error'
    });
  }
});

// Get all exam centres
router.get('/', (req, res) => {
  try {
    logger.info('Fetching all exam centres', { ip: req.ip });

    const centres = examCentres.map(centre => ({
      examId: centre.examId,
      centreCode: centre.centreCode,
      centreName: centre.centreName,
      examDate: centre.examDate,
      sessions: centre.sessions
    }));

    logger.success('All exam centres retrieved', { count: centres.length });

    res.json({
      successful: true,
      data: centres,
      count: centres.length
    });

  } catch (error) {
    logger.error('Error fetching all exam centres', {
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
