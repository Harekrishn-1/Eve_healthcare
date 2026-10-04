const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { validateBooking } = require('../middleware/validate');
const { authenticateToken } = require('../middleware/auth');

// All booking routes require authentication
router.use(authenticateToken);

// POST /bookings - Create a booking
router.post('/', validateBooking, bookingController.createBooking);

// GET /bookings - Get all bookings of logged-in user
router.get('/', bookingController.getUserBookings);

// GET /bookings/:id - Get specific booking by ID (only owner allowed)
router.get('/:id', bookingController.getBookingById);

// POST /bookings/:id/cancel - Cancel booking (only owner allowed)
router.post('/:id/cancel', bookingController.cancelBooking);

module.exports = router;
