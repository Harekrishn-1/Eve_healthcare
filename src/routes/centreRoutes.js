const express = require('express');
const router = express.Router();
const centreController = require('../controllers/centreController');
const { validateCentre, validateTest } = require('../middleware/validate');
const { authenticateToken } = require('../middleware/auth');

// GET /centres - Get all diagnostic centres with their tests
router.get('/', centreController.getAllCentres);

// GET /centres/:id - Get specific diagnostic centre by ID
router.get('/:id', centreController.getCentreById);

// POST /centres - Create a new diagnostic centre (Protected)
router.post('/', authenticateToken, validateCentre, centreController.createCentre);

// POST /centres/:id/tests - Add a test to a centre (Protected)
router.post('/:id/tests', authenticateToken, validateTest, centreController.addTestToCentre);

module.exports = router;
