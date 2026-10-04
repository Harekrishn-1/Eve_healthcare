const db = require('../db');

// Valid booking status transitions
const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'];

// Create a new booking
const createBooking = async (req, res) => {
  const userId = req.user.id;
  const { centre_id, test_id, appointment_date } = req.body;

  try {
    // 1. Verify that the centre exists
    const centreCheck = await db.query('SELECT id, name FROM diagnostic_centres WHERE id = $1', [centre_id]);
    if (centreCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Diagnostic centre not found.' });
    }

    // 2. Verify that the test exists and belongs to this centre
    const testCheck = await db.query(
      'SELECT id, name, price, centre_id FROM diagnostic_tests WHERE id = $1',
      [test_id]
    );
    if (testCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Diagnostic test not found.' });
    }

    const test = testCheck.rows[0];
    if (test.centre_id !== parseInt(centre_id, 10)) {
      return res.status(400).json({
        success: false,
        error: 'The requested test does not belong to the selected diagnostic centre.'
      });
    }

    // 3. Amount is taken directly from the verified test price to prevent tampering
    const amount = test.price;

    // 4. Create booking with PENDING status
    const bookingResult = await db.query(
      `INSERT INTO bookings (user_id, centre_id, test_id, appointment_date, amount, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING id, user_id, centre_id, test_id, appointment_date, amount, status, created_at`,
      [userId, centre_id, test_id, appointment_date, amount]
    );

    const booking = bookingResult.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Booking initiated successfully. Please proceed to payment.',
      data: {
        ...booking,
        patient_name: req.user.name,
        centre_name: centreCheck.rows[0].name,
        test_name: test.name
      }
    });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

// Get all bookings for the authenticated user
const getUserBookings = async (req, res) => {
  const userId = req.user.id;

  try {
    const query = `
      SELECT 
        b.id,
        b.appointment_date,
        b.amount,
        b.status,
        b.created_at,
        b.updated_at,
        u.id AS user_id,
        u.name AS patient_name,
        u.email AS patient_email,
        c.id AS centre_id,
        c.name AS centre_name,
        c.location AS centre_location,
        t.id AS test_id,
        t.name AS test_name,
        t.description AS test_description
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN diagnostic_centres c ON b.centre_id = c.id
      JOIN diagnostic_tests t ON b.test_id = t.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC;
    `;
    const result = await db.query(query, [userId]);
    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('Fetch bookings error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

// Get booking details by ID (with authorization check)
const getBookingById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  if (isNaN(Number(id))) {
    return res.status(400).json({ success: false, error: 'Invalid booking ID format.' });
  }

  try {
    const query = `
      SELECT 
        b.id,
        b.appointment_date,
        b.amount,
        b.status,
        b.created_at,
        b.updated_at,
        u.id AS user_id,
        u.name AS patient_name,
        u.email AS patient_email,
        c.id AS centre_id,
        c.name AS centre_name,
        c.location AS centre_location,
        t.id AS test_id,
        t.name AS test_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN diagnostic_centres c ON b.centre_id = c.id
      JOIN diagnostic_tests t ON b.test_id = t.id
      WHERE b.id = $1;
    `;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    const booking = result.rows[0];

    // Authorization edge case: Cannot view someone else's booking
    if (booking.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to view this booking.'
      });
    }

    return res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Get booking error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

// Cancel a booking (with authorization check)
const cancelBooking = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  if (isNaN(Number(id))) {
    return res.status(400).json({ success: false, error: 'Invalid booking ID format.' });
  }

  try {
    const checkResult = await db.query('SELECT id, user_id, status FROM bookings WHERE id = $1', [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    const booking = checkResult.rows[0];

    // Authorization edge case: Cannot cancel someone else's booking
    if (booking.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to modify this booking.'
      });
    }

    // Edge case: Already cancelled or failed
    if (booking.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Booking is already cancelled.'
      });
    }

    if (booking.status === 'FAILED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a booking that has already failed.'
      });
    }

    const updateResult = await db.query(
      `UPDATE bookings 
       SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, status, updated_at`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully.',
      data: updateResult.rows[0]
    });
  } catch (err) {
    console.error('Cancel booking error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking
};
