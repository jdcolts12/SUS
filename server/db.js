import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../data/game.db');

const USE_TURSO = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
let db; // better-sqlite3
let turso; // @libsql/client

function getDb() {
  if (!db) {
    const dataDir = join(__dirname, '../data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    db = new Database(dbPath);
    initSchemaSqlite(db);
  }
  return db;
}

function getTurso() {
  if (!turso) {
    turso = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return turso;
}

async function initSchemaTurso() {
  const client = getTurso();
  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      profile_pic TEXT,
      bg_color TEXT DEFAULT '#1a1a2e',
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )`,
    `CREATE TABLE IF NOT EXISTS used_usernames (username TEXT PRIMARY KEY)`,
    `CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      UNIQUE(from_user_id, to_user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS friendships (
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      created_at INTEGER,
      PRIMARY KEY (user_id, friend_id)
    )`,
    `CREATE TABLE IF NOT EXISTS round_results (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      was_imposter INTEGER NOT NULL,
      won INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_round_results_user ON round_results(user_id)`,
  ]);
}

function initSchemaSqlite(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      profile_pic TEXT,
      bg_color TEXT DEFAULT '#1a1a2e',
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS used_usernames (username TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id),
      UNIQUE(from_user_id, to_user_id)
    );
    CREATE TABLE IF NOT EXISTS friendships (
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (user_id, friend_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (friend_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS round_results (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      was_imposter INTEGER NOT NULL,
      won INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_round_results_user ON round_results(user_id);
  `);
  const cols = database.prepare('PRAGMA table_info(users)').all();
  if (!cols.some((c) => c.name === 'password_hash')) {
    try {
      database.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
    } catch (_) {}
  }
}

function rowToObj(columns, row) {
  const obj = {};
  columns.forEach((col, i) => {
    obj[col.name] = row[i];
  });
  return obj;
}

// ---- Sync SQLite implementations ----
function createUserSqlite(username, password) {
  const database = getDb();
  if (!password || String(password).length < 4) {
    return { error: 'Password must be at least 4 characters' };
  }
  const id = crypto.randomUUID();
  const normalizedUsername = username.trim().toLowerCase();
  const existing = database.prepare(
    'SELECT id FROM users WHERE username = ? OR LOWER(username) = ?'
  ).get(username.trim(), normalizedUsername);
  if (existing) return { error: 'Username taken' };
  const used = database.prepare('SELECT 1 FROM used_usernames WHERE username = ?').get(normalizedUsername);
  if (used) return { error: 'Username was already used' };
  const passwordHash = bcrypt.hashSync(String(password), 10);
  database.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username.trim(), passwordHash);
  database.prepare('INSERT INTO used_usernames (username) VALUES (?)').run(normalizedUsername);
  return { userId: id, username: username.trim() };
}

function signInSqlite(username, password) {
  const database = getDb();
  const user = database.prepare('SELECT id, username, password_hash FROM users WHERE LOWER(username) = ?')
    .get(username.trim().toLowerCase());
  if (!user) return { error: 'Invalid username or password' };
  if (!user.password_hash) return { error: 'Please create a new account—this username was created before passwords were required.' };
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    return { error: 'Invalid username or password' };
  }
  return { userId: user.id, username: user.username };
}

function getUserSqlite(userId) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

// ---- Turso (async) implementations ----
async function createUserTurso(username, password) {
  if (!password || String(password).length < 4) {
    return { error: 'Password must be at least 4 characters' };
  }
  const client = getTurso();
  await initSchemaTurso();
  const id = crypto.randomUUID();
  const normalizedUsername = username.trim().toLowerCase();
  const existing = await client.execute({
    sql: 'SELECT id FROM users WHERE LOWER(username) = ?',
    args: [normalizedUsername],
  });
  if (existing.rows.length > 0) return { error: 'Username taken' };
  const used = await client.execute({
    sql: 'SELECT 1 FROM used_usernames WHERE username = ?',
    args: [normalizedUsername],
  });
  if (used.rows.length > 0) return { error: 'Username was already used' };
  const passwordHash = bcrypt.hashSync(String(password), 10);
  await client.batch([
    {
      sql: 'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      args: [id, username.trim(), passwordHash],
    },
    {
      sql: 'INSERT INTO used_usernames (username) VALUES (?)',
      args: [normalizedUsername],
    },
  ]);
  return { userId: id, username: username.trim() };
}

async function signInTurso(username, password) {
  const client = getTurso();
  const res = await client.execute({
    sql: 'SELECT id, username, password_hash FROM users WHERE LOWER(username) = ?',
    args: [username.trim().toLowerCase()],
  });
  if (res.rows.length === 0) return { error: 'Invalid username or password' };
  const user = rowToObj(res.columns, res.rows[0]);
  if (!user.password_hash) return { error: 'Please create a new account—this username was created before passwords were required.' };
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    return { error: 'Invalid username or password' };
  }
  return { userId: user.id, username: user.username };
}

async function getUserTurso(userId) {
  const client = getTurso();
  const res = await client.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [userId],
  });
  if (res.rows.length === 0) return null;
  return rowToObj(res.columns, res.rows[0]);
}

// ---- Public API (async, works with both) ----
export async function createUser(username, password) {
  if (USE_TURSO) return createUserTurso(username, password);
  return createUserSqlite(username, password);
}

export async function signIn(username, password) {
  if (USE_TURSO) return signInTurso(username, password);
  return signInSqlite(username, password);
}

export async function getUser(userId) {
  if (USE_TURSO) return getUserTurso(userId);
  return getUserSqlite(userId);
}

export async function updateUser(userId, updates) {
  if (USE_TURSO) {
    const client = getTurso();
    const u = await getUserTurso(userId);
    if (!u) return { error: 'User not found' };
    if (updates.username) {
      const newName = updates.username.trim();
      const normalized = newName.toLowerCase();
      const oldNormalized = u.username.toLowerCase();
      if (normalized !== oldNormalized) {
        const ex = await client.execute({
          sql: 'SELECT id FROM users WHERE LOWER(username) = ? AND id != ?',
          args: [normalized, userId],
        });
        if (ex.rows.length > 0) return { error: 'Username taken' };
        const used = await client.execute({
          sql: 'SELECT 1 FROM used_usernames WHERE username = ?',
          args: [normalized],
        });
        if (used.rows.length > 0) return { error: 'Username was already used' };
        await client.execute({
          sql: 'UPDATE users SET username = ? WHERE id = ?',
          args: [newName, userId],
        });
        await client.execute({
          sql: 'INSERT OR IGNORE INTO used_usernames (username) VALUES (?)',
          args: [oldNormalized],
        });
      }
    }
    if (updates.profile_pic !== undefined) {
      await client.execute({
        sql: 'UPDATE users SET profile_pic = ? WHERE id = ?',
        args: [updates.profile_pic, userId],
      });
    }
    if (updates.bg_color !== undefined) {
      await client.execute({
        sql: 'UPDATE users SET bg_color = ? WHERE id = ?',
        args: [updates.bg_color, userId],
      });
    }
    return { success: true };
  }
  const database = getDb();
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { error: 'User not found' };
  if (updates.username) {
    const newName = updates.username.trim();
    const normalized = newName.toLowerCase();
    const oldNormalized = user.username.toLowerCase();
    if (normalized !== oldNormalized) {
      const existing = database.prepare('SELECT id FROM users WHERE LOWER(username) = ? AND id != ?').get(normalized, userId);
      if (existing) return { error: 'Username taken' };
      const used = database.prepare('SELECT 1 FROM used_usernames WHERE username = ?').get(normalized);
      if (used) return { error: 'Username was already used' };
      database.prepare('UPDATE users SET username = ? WHERE id = ?').run(newName, userId);
      database.prepare('INSERT OR IGNORE INTO used_usernames (username) VALUES (?)').run(oldNormalized);
    }
  }
  if (updates.profile_pic !== undefined) {
    database.prepare('UPDATE users SET profile_pic = ? WHERE id = ?').run(updates.profile_pic, userId);
  }
  if (updates.bg_color !== undefined) {
    database.prepare('UPDATE users SET bg_color = ? WHERE id = ?').run(updates.bg_color, userId);
  }
  return { success: true };
}

export async function sendFriendRequest(fromId, toUsername) {
  if (USE_TURSO) {
    const client = getTurso();
    const toRes = await client.execute({
      sql: 'SELECT id FROM users WHERE LOWER(username) = ?',
      args: [toUsername.trim().toLowerCase()],
    });
    if (toRes.rows.length === 0) return { error: 'User not found' };
    const toUser = rowToObj(toRes.columns, toRes.rows[0]);
    if (toUser.id === fromId) return { error: 'Cannot add yourself' };
    const ex = await client.execute({
      sql: 'SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      args: [fromId, toUser.id, toUser.id, fromId],
    });
    if (ex.rows.length > 0) return { error: 'Already friends' };
    const pend = await client.execute({
      sql: 'SELECT 1 FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = ?',
      args: [fromId, toUser.id, 'pending'],
    });
    if (pend.rows.length > 0) return { error: 'Request already sent' };
    const id = crypto.randomUUID();
    await client.execute({
      sql: 'INSERT INTO friend_requests (id, from_user_id, to_user_id) VALUES (?, ?, ?)',
      args: [id, fromId, toUser.id],
    });
    return { success: true };
  }
  const database = getDb();
  const toUser = database.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(toUsername.trim().toLowerCase());
  if (!toUser) return { error: 'User not found' };
  if (toUser.id === fromId) return { error: 'Cannot add yourself' };
  const existing = database.prepare(
    'SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
  ).get(fromId, toUser.id, toUser.id, fromId);
  if (existing) return { error: 'Already friends' };
  const pending = database.prepare(
    'SELECT 1 FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = ?'
  ).get(fromId, toUser.id, 'pending');
  if (pending) return { error: 'Request already sent' };
  const id = crypto.randomUUID();
  database.prepare('INSERT INTO friend_requests (id, from_user_id, to_user_id) VALUES (?, ?, ?)').run(id, fromId, toUser.id);
  return { success: true };
}

export async function acceptFriendRequest(requestId, userId) {
  if (USE_TURSO) {
    const client = getTurso();
    const reqRes = await client.execute({
      sql: 'SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = ?',
      args: [requestId, userId, 'pending'],
    });
    if (reqRes.rows.length === 0) return { error: 'Request not found' };
    const req = rowToObj(reqRes.columns, reqRes.rows[0]);
    await client.batch([
      { sql: 'UPDATE friend_requests SET status = ? WHERE id = ?', args: ['accepted', requestId] },
      {
        sql: 'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?), (?, ?)',
        args: [req.from_user_id, req.to_user_id, req.to_user_id, req.from_user_id],
      },
    ]);
    return { success: true };
  }
  const database = getDb();
  const req = database.prepare(
    'SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = ?'
  ).get(requestId, userId, 'pending');
  if (!req) return { error: 'Request not found' };
  database.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('accepted', requestId);
  database.prepare(
    'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?), (?, ?)'
  ).run(req.from_user_id, req.to_user_id, req.to_user_id, req.from_user_id);
  return { success: true };
}

export async function getFriendRequests(userId) {
  if (USE_TURSO) {
    const client = getTurso();
    const res = await client.execute({
      sql: `SELECT fr.id, fr.from_user_id, u.username, u.profile_pic, u.bg_color
        FROM friend_requests fr
        JOIN users u ON u.id = fr.from_user_id
        WHERE fr.to_user_id = ? AND fr.status = 'pending'`,
      args: [userId],
    });
    return res.rows.map((r) => rowToObj(res.columns, r));
  }
  return getDb().prepare(`
    SELECT fr.id, fr.from_user_id, u.username, u.profile_pic, u.bg_color
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id = ? AND fr.status = 'pending'
  `).all(userId);
}

export async function getFriends(userId) {
  if (USE_TURSO) {
    const client = getTurso();
    const res = await client.execute({
      sql: `SELECT u.id, u.username, u.profile_pic, u.bg_color
        FROM friendships f
        JOIN users u ON u.id = f.friend_id
        WHERE f.user_id = ?`,
      args: [userId],
    });
    return res.rows.map((r) => rowToObj(res.columns, r));
  }
  return getDb().prepare(`
    SELECT u.id, u.username, u.profile_pic, u.bg_color
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
  `).all(userId);
}

export async function getUserStats(userId) {
  if (USE_TURSO) {
    const client = getTurso();
    const res = await client.execute({
      sql: 'SELECT was_imposter, won FROM round_results WHERE user_id = ?',
      args: [userId],
    });
    let teamWins = 0, teamLosses = 0, imposterWins = 0, imposterLosses = 0;
    res.rows.forEach((r) => {
      const wasImposter = r[0] !== 0;
      const won = r[1] !== 0;
      if (wasImposter) {
        if (won) imposterWins++;
        else imposterLosses++;
      } else {
        if (won) teamWins++;
        else teamLosses++;
      }
    });
    return { teamWins, teamLosses, imposterWins, imposterLosses };
  }
  const rows = getDb().prepare('SELECT was_imposter, won FROM round_results WHERE user_id = ?').all(userId);
  let teamWins = 0, teamLosses = 0, imposterWins = 0, imposterLosses = 0;
  rows.forEach((r) => {
    if (r.was_imposter) {
      if (r.won) imposterWins++;
      else imposterLosses++;
    } else {
      if (r.won) teamWins++;
      else teamLosses++;
    }
  });
  return { teamWins, teamLosses, imposterWins, imposterLosses };
}

export async function recordRoundResult(userId, wasImposter, won) {
  if (USE_TURSO) {
    const client = getTurso();
    await client.execute({
      sql: 'INSERT INTO round_results (id, user_id, was_imposter, won) VALUES (?, ?, ?, ?)',
      args: [crypto.randomUUID(), userId, wasImposter ? 1 : 0, won ? 1 : 0],
    });
    return;
  }
  getDb().prepare(
    'INSERT INTO round_results (id, user_id, was_imposter, won) VALUES (?, ?, ?, ?)'
  ).run(crypto.randomUUID(), userId, wasImposter ? 1 : 0, won ? 1 : 0);
}

export async function findByUsername(username) {
  if (USE_TURSO) {
    const client = getTurso();
    const res = await client.execute({
      sql: 'SELECT id, username, profile_pic, bg_color FROM users WHERE LOWER(username) = ?',
      args: [username.trim().toLowerCase()],
    });
    if (res.rows.length === 0) return null;
    return rowToObj(res.columns, res.rows[0]);
  }
  return getDb().prepare(
    'SELECT id, username, profile_pic, bg_color FROM users WHERE LOWER(username) = ?'
  ).get(username.trim().toLowerCase());
}
