const db = require('../db');

// Get all diagnostic centres with their available tests
const getAllCentres = async (req, res) => {
  try {
    const centresQuery = `
      SELECT 
        c.id, 
        c.name, 
        c.location, 
        c.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'name', t.name,
              'description', t.description,
              'price', t.price
            )
          ) FILTER (WHERE t.id IS NOT NULL), '[]'
        ) AS available_tests
      FROM diagnostic_centres c
      LEFT JOIN diagnostic_tests t ON c.id = t.centre_id
      GROUP BY c.id
      ORDER BY c.id ASC;
    `;
    const result = await db.query(centresQuery);
    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching centres:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

// Get single diagnostic centre by ID
const getCentreById = async (req, res) => {
  const { id } = req.params;
  try {
    const centreQuery = `
      SELECT 
        c.id, 
        c.name, 
        c.location, 
        c.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'name', t.name,
              'description', t.description,
              'price', t.price
            )
          ) FILTER (WHERE t.id IS NOT NULL), '[]'
        ) AS available_tests
      FROM diagnostic_centres c
      LEFT JOIN diagnostic_tests t ON c.id = t.centre_id
      WHERE c.id = $1
      GROUP BY c.id;
    `;
    const result = await db.query(centreQuery, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Diagnostic centre not found.' });
    }
    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error fetching centre by ID:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

// Create a new diagnostic centre
const createCentre = async (req, res) => {
  const { name, location } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO diagnostic_centres (name, location)
       VALUES ($1, $2)
       RETURNING id, name, location, created_at`,
      [name.trim(), location.trim()]
    );
    return res.status(201).json({
      success: true,
      message: 'Diagnostic centre created successfully.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating centre:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

// Add a test to a diagnostic centre
const addTestToCentre = async (req, res) => {
  const { id: centreId } = req.params;
  const { name, description, price } = req.body;

  try {
    // Check if centre exists
    const centreCheck = await db.query('SELECT id FROM diagnostic_centres WHERE id = $1', [centreId]);
    if (centreCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Diagnostic centre not found.' });
    }

    const result = await db.query(
      `INSERT INTO diagnostic_tests (centre_id, name, description, price)
       VALUES ($1, $2, $3, $4)
       RETURNING id, centre_id, name, description, price, created_at`,
      [centreId, name.trim(), description || null, parseFloat(price)]
    );

    return res.status(201).json({
      success: true,
      message: 'Diagnostic test added successfully.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error adding test:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

// Get all tests (with centre details)
const getAllTests = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        t.id, 
        t.name, 
        t.description, 
        t.price, 
        t.centre_id,
        c.name AS centre_name,
        c.location AS centre_location
      FROM diagnostic_tests t
      JOIN diagnostic_centres c ON t.centre_id = c.id
      ORDER BY t.id ASC
    `);
    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching tests:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

module.exports = {
  getAllCentres,
  getCentreById,
  createCentre,
  addTestToCentre,
  getAllTests
};
