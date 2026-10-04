const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

// 4. Simulated Payment Service: POST /payments/ (Authenticated user paying for booking)
router.post('/', authenticateToken, paymentController.processPayment);

// 5. Payment Webhook: POST /payments/webhook/ (Payment gateway webhook, strictly idempotent)
router.post('/webhook', paymentController.handlePaymentWebhook);

module.exports = router;
