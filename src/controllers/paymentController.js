const db = require('../db');
const crypto = require('crypto');

// 4. Simulated Payment Service: POST /payments/
const processPayment = async (req, res) => {
  const userId = req.user.id;
  const { booking_id, status } = req.body;

  if (!booking_id || isNaN(Number(booking_id))) {
    return res.status(400).json({ success: false, error: 'Valid booking_id is required.' });
  }

  // Allow explicit status ('SUCCESS' or 'FAILED') for deterministic testing, default to SUCCESS
  const paymentStatus = (status && ['SUCCESS', 'FAILED'].includes(status.toUpperCase()))
    ? status.toUpperCase()
    : 'SUCCESS';

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Fetch booking
    const bookingResult = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [booking_id]);
    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    const booking = bookingResult.rows[0];

    // Authorization edge case: Ensure booking belongs to user
    if (booking.user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to pay for this booking.'
      });
    }

    // Edge case: Booking cannot be paid if CANCELLED
    if (booking.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Cannot process payment for a cancelled booking.'
      });
    }

    // Edge case: Booking is already paid/confirmed
    if (booking.status === 'CONFIRMED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Booking is already confirmed and paid.'
      });
    }

    const transactionId = 'TXN_' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const newBookingStatus = paymentStatus === 'SUCCESS' ? 'CONFIRMED' : 'FAILED';

    // Insert payment record
    const paymentInsert = await client.query(
      `INSERT INTO payments (booking_id, amount, status, transaction_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, booking_id, amount, status, transaction_id, created_at`,
      [booking.id, booking.amount, paymentStatus, transactionId]
    );

    // Update booking status
    await client.query(
      `UPDATE bookings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newBookingStatus, booking.id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Payment simulated: ${paymentStatus}`,
      data: {
        payment: paymentInsert.rows[0],
        booking_status: newBookingStatus
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Payment processing error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  } finally {
    client.release();
  }
};

// 5. Payment Webhook: POST /payments/webhook/
// Must be strictly idempotent: Repeated events will not create duplicate payments or corrupt state
const handlePaymentWebhook = async (req, res) => {
  const { event_id, booking_id, status, transaction_id } = req.body;

  // Validation
  if (!event_id || typeof event_id !== 'string') {
    return res.status(400).json({ success: false, error: 'event_id string is required for webhook tracking.' });
  }
  if (!booking_id || isNaN(Number(booking_id))) {
    return res.status(400).json({ success: false, error: 'Valid booking_id is required.' });
  }
  if (!status || !['SUCCESS', 'FAILED'].includes(status.toUpperCase())) {
    return res.status(400).json({ success: false, error: 'Valid status ("SUCCESS" or "FAILED") is required.' });
  }

  const normalizedStatus = status.toUpperCase();

  // Check if event has already been processed (Idempotency check)
  const existingEvent = await db.query(
    'SELECT * FROM processed_webhook_events WHERE event_id = $1',
    [event_id]
  );

  if (existingEvent.rows.length > 0) {
    // Return success without re-executing or creating duplicate entries
    return res.status(200).json({
      success: true,
      idempotent: true,
      message: 'Webhook event was already processed previously. No duplicate actions taken.',
      data: existingEvent.rows[0]
    });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock and check booking
    const bookingResult = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [booking_id]);
    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Booking referenced in webhook does not exist.' });
    }

    const booking = bookingResult.rows[0];
    const txnId = transaction_id || ('WH_TXN_' + crypto.randomBytes(6).toString('hex').toUpperCase());

    // 2. Insert into processed_webhook_events
    const eventInsert = await client.query(
      `INSERT INTO processed_webhook_events (event_id, booking_id, status)
       VALUES ($1, $2, $3)
       RETURNING id, event_id, booking_id, status, processed_at`,
      [event_id, booking_id, normalizedStatus]
    );

    // 3. Insert payment record
    const paymentInsert = await client.query(
      `INSERT INTO payments (booking_id, amount, status, transaction_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, booking_id, amount, status, transaction_id, created_at`,
      [booking.id, booking.amount, normalizedStatus, txnId]
    );

    // 4. Update booking status safely
    // If booking was already cancelled, we do not revert it to confirmed
    let finalBookingStatus = booking.status;
    if (booking.status !== 'CANCELLED') {
      finalBookingStatus = normalizedStatus === 'SUCCESS' ? 'CONFIRMED' : 'FAILED';
      await client.query(
        `UPDATE bookings 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [finalBookingStatus, booking.id]
      );
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      idempotent: false,
      message: `Webhook processed successfully. Booking status updated to ${finalBookingStatus}.`,
      data: {
        webhook_event: eventInsert.rows[0],
        payment: paymentInsert.rows[0],
        booking_status: finalBookingStatus
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    // If concurrent race condition hits unique constraint on event_id
    if (err.code === '23505') {
      return res.status(200).json({
        success: true,
        idempotent: true,
        message: 'Concurrent webhook event already processed.'
      });
    }
    console.error('Webhook processing error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  } finally {
    client.release();
  }
};

module.exports = {
  processPayment,
  handlePaymentWebhook
};
