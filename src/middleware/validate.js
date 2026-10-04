// Basic request validation helpers
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const validateSignup = (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Name is required and must be a valid string.' });
  }
  if (!email || !validateEmail(email)) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !validateEmail(email)) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password is required.' });
  }
  next();
};

const validateCentre = (req, res, next) => {
  const { name, location } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Centre name is required.' });
  }
  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Centre location is required.' });
  }
  next();
};

const validateTest = (req, res, next) => {
  const { name, price } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Test name is required.' });
  }
  if (price === undefined || isNaN(Number(price)) || Number(price) <= 0) {
    return res.status(400).json({ success: false, error: 'Price must be a valid positive number.' });
  }
  next();
};

const validateBooking = (req, res, next) => {
  const { centre_id, test_id, appointment_date } = req.body;
  if (!centre_id || isNaN(Number(centre_id))) {
    return res.status(400).json({ success: false, error: 'Valid centre_id is required.' });
  }
  if (!test_id || isNaN(Number(test_id))) {
    return res.status(400).json({ success: false, error: 'Valid test_id is required.' });
  }
  if (!appointment_date || isNaN(Date.parse(appointment_date))) {
    return res.status(400).json({ success: false, error: 'Valid appointment_date (ISO 8601 format) is required.' });
  }
  next();
};

module.exports = {
  validateSignup,
  validateLogin,
  validateCentre,
  validateTest,
  validateBooking
};
