const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryOne, runStmt, saveDb } = require('../database/db');
const { authenticate, JWT_SECRET, loginLimiter } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already registered.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await runStmt(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, hash, 'attendant']
    );
    saveDb();

    const token = jwt.sign(
      { id: result.lastInsertRowid, username, email, role: 'attendant' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful.',
      token,
      user: { id: result.lastInsertRowid, username, email, role: 'attendant' }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await queryOne('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await queryOne('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
