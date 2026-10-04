const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Authorization header missing. Access denied.'
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token format. Expected Bearer <token>'
    });
  }

  const token = parts[1];

  jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_12345', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token.'
      });
    }

    req.user = user;
    next();
  });
};

module.exports = {
  authenticateToken
};
