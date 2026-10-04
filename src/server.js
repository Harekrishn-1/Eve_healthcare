require('dotenv').config();
const app = require('./app');
const { initDb } = require('./db');

const PORT = process.env.PORT || 5000;

// Initialize database schema and start server
const startServer = async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` EVE Healthcare Server listening on port ${PORT}`);
      console.log(` Health check: http://localhost:${PORT}/`);
      console.log(`===============================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
