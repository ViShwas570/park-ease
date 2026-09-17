const express = require('express');
const { queryOne, queryAll, queryCount, runStmt, saveDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function calcFee(record, pricing) {
  const checkIn = new Date(record.check_in_time.includes('Z') ? record.check_in_time : record.check_in_time + 'Z');
  const checkOut = new Date();
  const diffMs = checkOut - checkIn;
  const durationHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));

  let fee = 0;
  if (durationHours === 1) {
    fee = pricing.first_hour_rate;
  } else {
    fee = pricing.first_hour_rate + (durationHours - 1) * pricing.additional_hour_rate;
  }
  fee = Math.min(fee, pricing.daily_cap);

  return { durationHours, fee };
}

/**
 * POST /api/parking/check-in
 */
router.post('/check-in', authenticate, async (req, res) => {
  try {
    const { plate_number, vehicle_type } = req.body;

    if (!plate_number || !vehicle_type) {
      return res.status(400).json({ error: 'Plate number and vehicle type are required.' });
    }
    if (!['compact', 'standard', 'ev'].includes(vehicle_type)) {
      return res.status(400).json({ error: 'Vehicle type must be compact, standard, or ev.' });
    }

    const alreadyParked = await queryOne(
      'SELECT id FROM parking_records WHERE plate_number = ? AND check_out_time IS NULL',
      [plate_number.toUpperCase()]
    );
    if (alreadyParked) {
      return res.status(409).json({ error: `Vehicle ${plate_number.toUpperCase()} is already checked in.` });
    }

    let spot;
    if (vehicle_type === 'ev') {
      spot = await queryOne(
        'SELECT spots.*, levels.name as level_name FROM spots JOIN levels ON spots.level_id = levels.id WHERE spot_type = ? AND is_occupied = 0 LIMIT 1',
        ['ev']
      );
      if (!spot) {
        return res.status(400).json({ error: 'No EV spots available. EV vehicles require an EV spot with charger.' });
      }
    } else {
      spot = await queryOne(
        'SELECT spots.*, levels.name as level_name FROM spots JOIN levels ON spots.level_id = levels.id WHERE spot_type = ? AND is_occupied = 0 LIMIT 1',
        [vehicle_type]
      );

      if (!spot && vehicle_type === 'compact') {
        spot = await queryOne(
          'SELECT spots.*, levels.name as level_name FROM spots JOIN levels ON spots.level_id = levels.id WHERE spot_type = ? AND is_occupied = 0 LIMIT 1',
          ['standard']
        );
      }

      if (!spot) {
        return res.status(400).json({ error: `No available spots for ${vehicle_type} vehicles.` });
      }
    }

    await runStmt('UPDATE spots SET is_occupied = 1 WHERE id = ?', [spot.id]);
    const result = await runStmt(
      'INSERT INTO parking_records (spot_id, plate_number, vehicle_type, checked_in_by) VALUES (?, ?, ?, ?)',
      [spot.id, plate_number.toUpperCase(), vehicle_type, req.user.id]
    );
    saveDb();

    res.status(201).json({
      message: 'Vehicle checked in successfully.',
      record: {
        id: result.lastInsertRowid,
        plate_number: plate_number.toUpperCase(),
        vehicle_type,
        spot_number: spot.spot_number,
        spot_type: spot.spot_type,
        level: spot.level_name,
        check_in_time: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/parking/check-out/:id
 */
router.post('/check-out/:id', authenticate, async (req, res) => {
  try {
    const recordId = req.params.id;

    const record = await queryOne(`
      SELECT pr.*, s.spot_number, s.spot_type, l.name as level_name
      FROM parking_records pr
      JOIN spots s ON pr.spot_id = s.id
      JOIN levels l ON s.level_id = l.id
      WHERE pr.id = ? AND pr.check_out_time IS NULL
    `, [recordId]);

    if (!record) {
      return res.status(404).json({ error: 'Active parking record not found.' });
    }

    const pricing = await queryOne('SELECT * FROM pricing WHERE vehicle_type = ?', [record.vehicle_type]);
    if (!pricing) {
      return res.status(500).json({ error: 'Pricing not configured for this vehicle type.' });
    }

    const { durationHours, fee } = calcFee(record, pricing);

    await runStmt(
      "UPDATE parking_records SET check_out_time = datetime('now'), duration_hours = ?, fee = ?, checked_out_by = ? WHERE id = ?",
      [durationHours, fee, req.user.id, recordId]
    );
    await runStmt('UPDATE spots SET is_occupied = 0 WHERE id = ?', [record.spot_id]);
    saveDb();

    res.json({
      message: 'Vehicle checked out successfully.',
      receipt: {
        id: Number(recordId),
        plate_number: record.plate_number,
        vehicle_type: record.vehicle_type,
        spot_number: record.spot_number,
        level: record.level_name,
        check_in_time: record.check_in_time,
        check_out_time: new Date().toISOString(),
        duration_hours: durationHours,
        fee: fee,
        pricing_applied: {
          first_hour: pricing.first_hour_rate,
          additional_per_hour: pricing.additional_hour_rate,
          daily_cap: pricing.daily_cap
        }
      }
    });
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/parking/force-checkout/:id  (admin only)
 * Frees a stuck spot when a car left without a normal checkout
 * (crash, forgotten checkout, etc). Fee is still calculated normally,
 * but the record is flagged force_closed so it's auditable.
 */
router.post('/force-checkout/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const recordId = req.params.id;

    const record = await queryOne(`
      SELECT pr.*, s.spot_number, s.spot_type, l.name as level_name
      FROM parking_records pr
      JOIN spots s ON pr.spot_id = s.id
      JOIN levels l ON s.level_id = l.id
      WHERE pr.id = ? AND pr.check_out_time IS NULL
    `, [recordId]);

    if (!record) {
      return res.status(404).json({ error: 'Active parking record not found.' });
    }

    const pricing = await queryOne('SELECT * FROM pricing WHERE vehicle_type = ?', [record.vehicle_type]);
    const { durationHours, fee } = pricing ? calcFee(record, pricing) : { durationHours: null, fee: null };

    await runStmt(
      "UPDATE parking_records SET check_out_time = datetime('now'), duration_hours = ?, fee = ?, checked_out_by = ?, force_closed = 1 WHERE id = ?",
      [durationHours, fee, req.user.id, recordId]
    );
    await runStmt('UPDATE spots SET is_occupied = 0 WHERE id = ?', [record.spot_id]);
    saveDb();

    res.json({
      message: `Spot ${record.spot_number} force-closed and freed by admin.`,
      record: { id: Number(recordId), plate_number: record.plate_number, spot_number: record.spot_number, fee, force_closed: true }
    });
  } catch (err) {
    console.error('Force checkout error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/parking/active
 */
router.get('/active', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'check_in_time';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const allowedSorts = ['check_in_time', 'plate_number', 'vehicle_type', 'spot_number'];
    const sortColumn = allowedSorts.includes(sortBy) ? sortBy : 'check_in_time';

    const total = await queryCount('SELECT COUNT(*) as count FROM parking_records WHERE check_out_time IS NULL');

    const records = await queryAll(`
      SELECT pr.*, s.spot_number, s.spot_type, l.name as level_name, u.username as checked_in_by_name
      FROM parking_records pr
      JOIN spots s ON pr.spot_id = s.id
      JOIN levels l ON s.level_id = l.id
      LEFT JOIN users u ON pr.checked_in_by = u.id
      WHERE pr.check_out_time IS NULL
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({
      data: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Active records error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/parking/history
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'check_in_time';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const allowedSorts = ['check_in_time', 'check_out_time', 'plate_number', 'vehicle_type', 'fee', 'duration_hours'];
    const sortColumn = allowedSorts.includes(sortBy) ? sortBy : 'check_in_time';

    const total = await queryCount('SELECT COUNT(*) as count FROM parking_records');

    const records = await queryAll(`
      SELECT pr.*, s.spot_number, s.spot_type, l.name as level_name, u.username as checked_in_by_name
      FROM parking_records pr
      JOIN spots s ON pr.spot_id = s.id
      JOIN levels l ON s.level_id = l.id
      LEFT JOIN users u ON pr.checked_in_by = u.id
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({
      data: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/parking/search?plate=ABC
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const { plate } = req.query;
    if (!plate) {
      return res.status(400).json({ error: 'Plate query parameter is required.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const searchTerm = `%${plate.toUpperCase()}%`;

    const total = await queryCount(
      'SELECT COUNT(*) as count FROM parking_records WHERE plate_number LIKE ?',
      [searchTerm]
    );

    const records = await queryAll(`
      SELECT pr.*, s.spot_number, s.spot_type, l.name as level_name, u.username as checked_in_by_name
      FROM parking_records pr
      JOIN spots s ON pr.spot_id = s.id
      JOIN levels l ON s.level_id = l.id
      LEFT JOIN users u ON pr.checked_in_by = u.id
      WHERE pr.plate_number LIKE ?
      ORDER BY pr.check_in_time DESC
      LIMIT ? OFFSET ?
    `, [searchTerm, limit, offset]);

    res.json({
      data: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
