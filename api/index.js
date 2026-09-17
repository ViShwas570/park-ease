const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('../database/db');

const app = express();

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ──
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), name: 'ParkEase API' });
});

// ── Database init promise (cached across warm invocations) ──
let dbInitialized = false;

async function ensureDb(req, res, next) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
  next();
}

app.use('/api', ensureDb);

// ── API Routes ──
app.use('/api/auth', require('../routes/auth'));
app.use('/api/parking', require('../routes/parking'));
app.use('/api/spots', require('../routes/spots'));
app.use('/api/pricing', require('../routes/pricing'));
app.use('/api/dashboard', require('../routes/dashboard'));

// ── Fallback: serve index.html for non-API routes ──
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// ── Error handling ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;
