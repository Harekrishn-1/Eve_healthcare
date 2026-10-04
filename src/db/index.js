const { Pool } = require('pg');
require('dotenv').config();

const isCloudDb = process.env.DATABASE_URL && (
  process.env.DATABASE_URL.includes('neon.tech') ||
  process.env.DATABASE_URL.includes('sslmode=require') ||
  process.env.DATABASE_SSL === 'true'
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isCloudDb ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

// Auto-initialize tables on startup
const initDb = async () => {
  const queryText = `
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Diagnostic Centres Table
    CREATE TABLE IF NOT EXISTS diagnostic_centres (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Diagnostic Tests Table (Tests offered by a centre)
    CREATE TABLE IF NOT EXISTS diagnostic_tests (
      id SERIAL PRIMARY KEY,
      centre_id INT NOT NULL REFERENCES diagnostic_centres(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price NUMERIC(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Bookings Table
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      centre_id INT NOT NULL REFERENCES diagnostic_centres(id) ON DELETE RESTRICT,
      test_id INT NOT NULL REFERENCES diagnostic_tests(id) ON DELETE RESTRICT,
      appointment_date TIMESTAMP NOT NULL,
      amount NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Payments Table
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      amount NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL,
      transaction_id VARCHAR(255) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Processed Webhook Events Table (Ensures Strict Idempotency)
    CREATE TABLE IF NOT EXISTS processed_webhook_events (
      id SERIAL PRIMARY KEY,
      event_id VARCHAR(255) UNIQUE NOT NULL,
      booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      status VARCHAR(50) NOT NULL,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(queryText);
    console.log('Database tables verified / initialized successfully.');

    // Seed default centres and tests if empty
    const checkCentres = await pool.query('SELECT COUNT(*) FROM diagnostic_centres');
    if (parseInt(checkCentres.rows[0].count, 10) === 0) {
      const centreInsert = await pool.query(`
        INSERT INTO diagnostic_centres (name, location)
        VALUES 
          ('EVE Central Diagnostic Hub', 'Connaught Place, New Delhi'),
          ('EVE Care Lab & Imaging', 'Koramangala, Bangalore')
        RETURNING id;
      `);

      const c1Id = centreInsert.rows[0].id;
      const c2Id = centreInsert.rows[1].id;

      await pool.query(`
        INSERT INTO diagnostic_tests (centre_id, name, description, price)
        VALUES 
          (${c1Id}, 'Complete Blood Count (CBC)', 'Full blood panel examination', 450.00),
          (${c1Id}, 'Lipid Profile', 'Cholesterol and triglycerides test', 750.00),
          (${c1Id}, 'Thyroid Stimulating Hormone (TSH)', 'Hormonal thyroid function check', 350.00),
          (${c2Id}, 'HbA1c Diabetes Screen', 'Glycated hemoglobin 3-month average', 550.00),
          (${c2Id}, 'Liver Function Test (LFT)', 'Hepatic panel profile', 850.00),
          (${c2Id}, 'Vitamin D3 & B12 Combo', 'Micronutrient deficiency screen', 1200.00);
      `);
      console.log('Initial sample diagnostic centres and tests seeded.');
    }
  } catch (error) {
    console.error('Error during database initialization:', error.message);
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb
};
