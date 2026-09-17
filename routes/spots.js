const express = require('express');
const { queryAll, queryOne, queryCount, runStmt, saveDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/spots
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const { type, level_id, status } = req.query;

    let whereConditions = [];
    let params = [];

    if (type && ['compact', 'standard', 'ev'].includes(type)) {
      whereConditions.push('s.spot_type = ?');
      params.push(type);
    }
    if (level_id) {
      whereConditions.push('s.level_id = ?');
      params.push(parseInt(level_id));
    }
    if (status === 'available') {
      whereConditions.push('s.is_occupied = 0');
    } else if (status === 'occupied') {
      whereConditions.push('s.is_occupied = 1');
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const total = await queryCount(`SELECT COUNT(*) as count FROM spots s ${whereClause}`, params);

    const spots = await queryAll(`
      SELECT s.*, l.name as level_name,
        CASE WHEN s.is_occupied = 1 THEN (
          SELECT pr.plate_number FROM parking_records pr WHERE pr.spot_id = s.id AND pr.check_out_time IS NULL LIMIT 1
        ) ELSE NULL END as current_plate
      FROM spots s
      JOIN levels l ON s.level_id = l.id
      ${whereClause}
      ORDER BY s.level_id, s.spot_number
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      data: spots,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Spots error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/spots/available
 */
router.get('/available', authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    let params = [];
    let typeFilter = '';

    if (type && ['compact', 'standard', 'ev'].includes(type)) {
      typeFilter = ' AND s.spot_type = ?';
      params.push(type);
    }

    const spots = await queryAll(`
      SELECT s.*, l.name as level_name
      FROM spots s
      JOIN levels l ON s.level_id = l.id
      WHERE s.is_occupied = 0 ${typeFilter}
      ORDER BY s.level_id, s.spot_number
    `, params);

    const summary = await queryAll(`
      SELECT spot_type,
        COUNT(*) as total,
        SUM(CASE WHEN is_occupied = 0 THEN 1 ELSE 0 END) as available
      FROM spots
      GROUP BY spot_type
    `);

    res.json({ spots, summary });
  } catch (err) {
    console.error('Available spots error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/spots/levels
 */
router.get('/levels', authenticate, async (req, res) => {
  try {
    const levels = await queryAll(`
      SELECT l.*,
        (SELECT COUNT(*) FROM spots s WHERE s.level_id = l.id AND s.is_occupied = 1) as occupied_spots,
        (SELECT COUNT(*) FROM spots s WHERE s.level_id = l.id AND s.is_occupied = 0) as available_spots
      FROM levels l
      ORDER BY l.id
    `);

    res.json({ levels });
  } catch (err) {
    console.error('Levels error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/spots/levels  (admin only) — add a new level to the garage
 */
router.post('/levels', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, compact = 0, standard = 0, ev = 0 } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Level name is required.' });
    }
    const totalSpots = Number(compact) + Number(standard) + Number(ev);
    if (totalSpots <= 0) {
      return res.status(400).json({ error: 'Provide at least one spot (compact/standard/ev).' });
    }

    const existing = await queryOne('SELECT id FROM levels WHERE name = ?', [name]);
    if (existing) {
      return res.status(409).json({ error: 'A level with this name already exists.' });
    }

    const levelResult = await runStmt('INSERT INTO levels (name, total_spots) VALUES (?, ?)', [name, totalSpots]);
    const levelId = levelResult.lastInsertRowid;

    // Figure out starting spot numbers so we don't collide across levels sharing prefixes
    let idx = 1;
    for (let i = 0; i < Number(compact); i++) {
      await runStmt('INSERT INTO spots (level_id, spot_number, spot_type) VALUES (?, ?, ?)', [levelId, `C-${String(idx).padStart(2, '0')}`, 'compact']);
      idx++;
    }
    for (let i = 0; i < Number(standard); i++) {
      await runStmt('INSERT INTO spots (level_id, spot_number, spot_type) VALUES (?, ?, ?)', [levelId, `S-${String(idx).padStart(2, '0')}`, 'standard']);
      idx++;
    }
    for (let i = 0; i < Number(ev); i++) {
      await runStmt('INSERT INTO spots (level_id, spot_number, spot_type) VALUES (?, ?, ?)', [levelId, `E-${String(idx).padStart(2, '0')}`, 'ev']);
      idx++;
    }
    saveDb();

    res.status(201).json({ message: 'Level added.', level: { id: levelId, name, total_spots: totalSpots } });
  } catch (err) {
    console.error('Add level error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/spots/levels/:id/spots
 */
router.get('/levels/:id/spots', authenticate, async (req, res) => {
  try {
    const levelId = req.params.id;
    const level = await queryOne('SELECT * FROM levels WHERE id = ?', [levelId]);
    if (!level) {
      return res.status(404).json({ error: 'Level not found.' });
    }

    const spots = await queryAll(`
      SELECT s.*,
        CASE WHEN s.is_occupied = 1 THEN (
          SELECT pr.plate_number FROM parking_records pr WHERE pr.spot_id = s.id AND pr.check_out_time IS NULL LIMIT 1
        ) ELSE NULL END as current_plate
      FROM spots s
      WHERE s.level_id = ?
      ORDER BY s.spot_number
    `, [levelId]);

    res.json({ level, spots });
  } catch (err) {
    console.error('Level spots error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
