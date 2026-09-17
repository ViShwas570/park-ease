const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./database/db');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ──
app.use(express.static(path.join(__dirname, 'public')));

// ── Health check (no auth) ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), name: 'ParkEase API' });
});

// ── Initialize database then start ──
async function start() {
  try {
    await initDb();
    console.log('✅ Database initialized');

    // ── API Routes ──
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/parking', require('./routes/parking'));
    app.use('/api/spots', require('./routes/spots'));
    app.use('/api/pricing', require('./routes/pricing'));
    app.use('/api/dashboard', require('./routes/dashboard'));

    // ── Fallback: serve index.html for non-API routes ──
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
      }
    });

    // ── Error handling middleware ──
    app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error.' });
    });

    // ── Start server ──
    app.listen(PORT, () => {
      console.log(`
  ╔═══════════════════════════════════════════╗
  ║         🅿️  ParkEase Server               ║
  ║   Multi-Level Parking Garage Management   ║
  ╠═══════════════════════════════════════════╣
  ║   🌐  http://localhost:${PORT}              ║
  ║   📊  API: http://localhost:${PORT}/api     ║
  ║   🔑  Default admin: admin / admin123     ║
  ╚═══════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
