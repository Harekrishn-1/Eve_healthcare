const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateSignup, validateLogin } = require('../middleware/validate');
const { authenticateToken } = require('../middleware/auth');

// POST /auth/signup
router.post('/signup', validateSignup, authController.signup);

// POST /auth/login
router.post('/login', validateLogin, authController.login);

// GET /auth/me (Protected - profile of logged-in user)
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
