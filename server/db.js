import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../data/game.db');

let db;

function getDb() {
  if (!db) {
    const dataDir = join(__dirname, '../data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    db = new Database(dbPath);
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      profile_pic TEXT,
      bg_color TEXT DEFAULT '#1a1a2e',
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS used_usernames (
      username TEXT PRIMARY KEY
    );

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
}

export function createUser(username) {
  const database = getDb();
  const id = crypto.randomUUID();
  const normalizedUsername = username.trim().toLowerCase();
  
  const existing = database.prepare(
    'SELECT id FROM users WHERE username = ? OR LOWER(username) = ?'
  ).get(username.trim(), normalizedUsername);
  
  if (existing) return { error: 'Username taken' };

  const used = database.prepare('SELECT 1 FROM used_usernames WHERE username = ?').get(normalizedUsername);
  if (used) return { error: 'Username was already used' };

  database.prepare(
    'INSERT INTO users (id, username) VALUES (?, ?)'
  ).run(id, username.trim());

  database.prepare(
    'INSERT INTO used_usernames (username) VALUES (?)'
  ).run(normalizedUsername);

  return { userId: id, username: username.trim() };
}

export function getUser(userId) {
  const database = getDb();
  return database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function updateUser(userId, updates) {
  const database = getDb();
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { error: 'User not found' };

  if (updates.username) {
    const newName = updates.username.trim();
    const normalized = newName.toLowerCase();
    const oldNormalized = user.username.toLowerCase();
    if (normalized !== oldNormalized) {
      const existing = database.prepare(
        'SELECT id FROM users WHERE LOWER(username) = ? AND id != ?'
      ).get(normalized, userId);
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

export function sendFriendRequest(fromId, toUsername) {
  const database = getDb();
  const toUser = database.prepare(
    'SELECT id FROM users WHERE LOWER(username) = ?'
  ).get(toUsername.trim().toLowerCase());
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
  database.prepare(
    'INSERT INTO friend_requests (id, from_user_id, to_user_id) VALUES (?, ?, ?)'
  ).run(id, fromId, toUser.id);
  return { success: true };
}

export function acceptFriendRequest(requestId, userId) {
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

export function getFriendRequests(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT fr.id, fr.from_user_id, u.username, u.profile_pic, u.bg_color
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id = ? AND fr.status = 'pending'
  `).all(userId);
}

export function getFriends(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT u.id, u.username, u.profile_pic, u.bg_color
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
  `).all(userId);
}

export function getUserStats(userId) {
  const database = getDb();
  const rows = database.prepare(
    'SELECT was_imposter, won FROM round_results WHERE user_id = ?'
  ).all(userId);

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

export function recordRoundResult(userId, wasImposter, won) {
  const database = getDb();
  database.prepare(
    'INSERT INTO round_results (id, user_id, was_imposter, won) VALUES (?, ?, ?, ?)'
  ).run(crypto.randomUUID(), userId, wasImposter ? 1 : 0, won ? 1 : 0);
}

export function findByUsername(username) {
  const database = getDb();
  return database.prepare(
    'SELECT id, username, profile_pic, bg_color FROM users WHERE LOWER(username) = ?'
  ).get(username.trim().toLowerCase());
}
