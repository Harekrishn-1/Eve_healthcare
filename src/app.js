const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const centreRoutes = require('./routes/centreRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Base health route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EVE Healthcare Backend API is running.',
    version: '1.0.0'
  });
});

// Register routes
app.use('/auth', authRoutes);
app.use('/centres', centreRoutes);
app.use('/bookings', bookingRoutes);
app.use('/payments', paymentRoutes);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found.`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error.'
  });
});

module.exports = app;
