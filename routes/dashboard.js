const express = require('express');
const { queryAll, queryOne, queryCount } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authenticate, async (req, res) => {
  try {
    const spotStats = await queryOne(`
      SELECT
        COUNT(*) as total_spots,
        SUM(CASE WHEN is_occupied = 1 THEN 1 ELSE 0 END) as occupied_spots,
        SUM(CASE WHEN is_occupied = 0 THEN 1 ELSE 0 END) as available_spots
      FROM spots
    `);

    const typeStats = await queryAll(`
      SELECT spot_type,
        COUNT(*) as total,
        SUM(CASE WHEN is_occupied = 1 THEN 1 ELSE 0 END) as occupied,
        SUM(CASE WHEN is_occupied = 0 THEN 1 ELSE 0 END) as available
      FROM spots
      GROUP BY spot_type
    `);

    const todayRevenue = await queryOne(`
      SELECT COALESCE(SUM(fee), 0) as revenue
      FROM parking_records
      WHERE check_out_time IS NOT NULL
        AND date(check_out_time) = date('now')
    `);

    const todayCheckIns = await queryOne(`
      SELECT COUNT(*) as count
      FROM parking_records
      WHERE date(check_in_time) = date('now')
    `);

    const todayCheckOuts = await queryOne(`
      SELECT COUNT(*) as count
      FROM parking_records
      WHERE check_out_time IS NOT NULL
        AND date(check_out_time) = date('now')
    `);

    const activeCount = await queryCount(
      'SELECT COUNT(*) as count FROM parking_records WHERE check_out_time IS NULL'
    );

    const recentActivity = await queryAll(`
      SELECT pr.*, s.spot_number, s.spot_type, l.name as level_name
      FROM parking_records pr
      JOIN spots s ON pr.spot_id = s.id
      JOIN levels l ON s.level_id = l.id
      ORDER BY pr.check_in_time DESC
      LIMIT 5
    `);

    const levelStats = await queryAll(`
      SELECT l.name,
        (SELECT COUNT(*) FROM spots s WHERE s.level_id = l.id) as total,
        (SELECT COUNT(*) FROM spots s WHERE s.level_id = l.id AND s.is_occupied = 1) as occupied
      FROM levels l
      ORDER BY l.id
    `);

    res.json({
      occupancy: {
        total: spotStats.total_spots,
        occupied: spotStats.occupied_spots,
        available: spotStats.available_spots,
        percentage: spotStats.total_spots > 0
          ? Math.round((spotStats.occupied_spots / spotStats.total_spots) * 100)
          : 0
      },
      byType: typeStats,
      today: {
        revenue: todayRevenue.revenue,
        checkIns: todayCheckIns.count,
        checkOuts: todayCheckOuts.count,
        active: activeCount
      },
      recentActivity,
      levelStats
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
