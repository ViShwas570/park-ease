const express = require('express');
const { queryAll, queryOne, runStmt, saveDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const pricing = await queryAll('SELECT * FROM pricing ORDER BY vehicle_type');
    res.json({ pricing });
  } catch (err) {
    console.error('Pricing error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { first_hour_rate, additional_hour_rate, daily_cap } = req.body;

    const existing = await queryOne('SELECT * FROM pricing WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Pricing tier not found.' });
    }

    if (first_hour_rate == null || additional_hour_rate == null || daily_cap == null) {
      return res.status(400).json({ error: 'All pricing fields are required.' });
    }

    const fhr = Number(first_hour_rate);
    const ahr = Number(additional_hour_rate);
    const cap = Number(daily_cap);

    if (Number.isNaN(fhr) || Number.isNaN(ahr) || Number.isNaN(cap)) {
      return res.status(400).json({ error: 'Pricing fields must be numbers.' });
    }
    if (fhr < 0 || ahr < 0 || cap < 0) {
      return res.status(400).json({ error: 'Pricing fields cannot be negative.' });
    }
    if (cap < fhr) {
      return res.status(400).json({ error: 'Daily cap cannot be less than the first-hour rate.' });
    }

    await runStmt(
      'UPDATE pricing SET first_hour_rate = ?, additional_hour_rate = ?, daily_cap = ? WHERE id = ?',
      [fhr, ahr, cap, req.params.id]
    );
    saveDb();

    const updated = await queryOne('SELECT * FROM pricing WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pricing updated successfully.', pricing: updated });
  } catch (err) {
    console.error('Update pricing error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
