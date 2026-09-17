const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// ── Connection ──
// Local dev (no env vars set): persists to a real SQLite file, parkease.db.
// Production (Vercel + Turso): set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
// as environment variables — data then persists across cold starts/deploys.
const DB_URL = process.env.TURSO_DATABASE_URL || 'file:./parkease.db';
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

let client = null;
let dbReady = null;

function initDb() {
  if (dbReady) return dbReady;

  dbReady = (async () => {
    client = createClient(
      AUTH_TOKEN ? { url: DB_URL, authToken: AUTH_TOKEN } : { url: DB_URL }
    );
    await initializeDatabase();
    return client;
  })();

  return dbReady;
}

function getDb() {
  return client;
}

// No-op: libSQL writes are durable immediately (local file or Turso),
// unlike sql.js which needed an explicit export+write. Kept for compatibility
// with any code that still calls saveDb().
function saveDb() {}

async function exec(sql, args = []) {
  return client.execute({ sql, args });
}

async function initializeDatabase() {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'attendant',
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      total_spots INTEGER NOT NULL DEFAULT 0
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id INTEGER NOT NULL,
      spot_number TEXT NOT NULL,
      spot_type TEXT NOT NULL,
      is_occupied INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (level_id) REFERENCES levels(id),
      UNIQUE(level_id, spot_number)
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS parking_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spot_id INTEGER NOT NULL,
      plate_number TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      check_in_time DATETIME NOT NULL DEFAULT (datetime('now')),
      check_out_time DATETIME,
      duration_hours REAL,
      fee REAL,
      checked_in_by INTEGER,
      checked_out_by INTEGER,
      force_closed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (spot_id) REFERENCES spots(id),
      FOREIGN KEY (checked_in_by) REFERENCES users(id),
      FOREIGN KEY (checked_out_by) REFERENCES users(id)
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_type TEXT NOT NULL UNIQUE,
      first_hour_rate REAL NOT NULL,
      additional_hour_rate REAL NOT NULL,
      daily_cap REAL NOT NULL
    );
  `);

  await exec(`CREATE INDEX IF NOT EXISTS idx_parking_plate ON parking_records(plate_number);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_parking_active ON parking_records(check_out_time);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_spots_type ON spots(spot_type);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_spots_occupied ON spots(is_occupied);`);

  await seedData();
}

async function seedData() {
  const result = await exec('SELECT COUNT(*) as count FROM levels');
  const levelCount = result.rows[0] ? Number(result.rows[0].count) : 0;

  if (levelCount === 0) {
    console.log('🌱 Seeding database with initial data...');

    const levels = [
      { name: 'Ground Floor', spots: 20 },
      { name: 'Level 1', spots: 25 },
      { name: 'Level 2', spots: 25 },
      { name: 'Level B1 (Basement)', spots: 15 }
    ];

    for (const level of levels) {
      const levelResult = await exec(
        'INSERT INTO levels (name, total_spots) VALUES (?, ?)',
        [level.name, level.spots]
      );
      const levelId = Number(levelResult.lastInsertRowid);

      let spotIndex = 1;
      const compactCount = Math.floor(level.spots * 0.3);
      const evCount = Math.floor(level.spots * 0.15);
      const standardCount = level.spots - compactCount - evCount;

      for (let i = 0; i < compactCount; i++) {
        const spotNum = `C-${String(spotIndex).padStart(2, '0')}`;
        await exec('INSERT INTO spots (level_id, spot_number, spot_type) VALUES (?, ?, ?)', [levelId, spotNum, 'compact']);
        spotIndex++;
      }
      for (let i = 0; i < standardCount; i++) {
        const spotNum = `S-${String(spotIndex).padStart(2, '0')}`;
        await exec('INSERT INTO spots (level_id, spot_number, spot_type) VALUES (?, ?, ?)', [levelId, spotNum, 'standard']);
        spotIndex++;
      }
      for (let i = 0; i < evCount; i++) {
        const spotNum = `E-${String(spotIndex).padStart(2, '0')}`;
        await exec('INSERT INTO spots (level_id, spot_number, spot_type) VALUES (?, ?, ?)', [levelId, spotNum, 'ev']);
        spotIndex++;
      }
    }

    await exec('INSERT INTO pricing (vehicle_type, first_hour_rate, additional_hour_rate, daily_cap) VALUES (?, ?, ?, ?)', ['compact', 30, 15, 150]);
    await exec('INSERT INTO pricing (vehicle_type, first_hour_rate, additional_hour_rate, daily_cap) VALUES (?, ?, ?, ?)', ['standard', 40, 20, 200]);
    await exec('INSERT INTO pricing (vehicle_type, first_hour_rate, additional_hour_rate, daily_cap) VALUES (?, ?, ?, ?)', ['ev', 50, 25, 250]);

    const hash = bcrypt.hashSync('admin123', 10);
    await exec('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)', ['admin', 'admin@parkease.com', hash, 'admin']);

    console.log('✅ Database seeded successfully');
  }
}

/** Run a query and return all rows as array of plain objects */
async function queryAll(sql, params = []) {
  const result = await exec(sql, params);
  return result.rows.map((row) => {
    const obj = {};
    for (const key of Object.keys(row)) obj[key] = row[key];
    return obj;
  });
}

/** Run a query and return first row as object or null */
async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/** Run an INSERT/UPDATE/DELETE and return changes info */
async function runStmt(sql, params = []) {
  const result = await exec(sql, params);
  return {
    changes: Number(result.rowsAffected),
    lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : 0
  };
}

/** Get a scalar count from the first column of the first row */
async function queryCount(sql, params = []) {
  const result = await queryOne(sql, params);
  if (!result) return 0;
  const keys = Object.keys(result);
  return Number(result[keys[0]]);
}

module.exports = { initDb, getDb, saveDb, queryAll, queryOne, runStmt, queryCount };
