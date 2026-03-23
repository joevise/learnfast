const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/learnfast.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function initDb() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      points TEXT,
      flashcards TEXT,
      quiz TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      UNIQUE(ip_hash, date)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key_hash TEXT UNIQUE NOT NULL,
      name TEXT,
      daily_limit INTEGER DEFAULT 100,
      daily_used INTEGER DEFAULT 0,
      last_used_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      id TEXT PRIMARY KEY,
      ip_hash TEXT UNIQUE NOT NULL,
      request_count INTEGER DEFAULT 0,
      window_start DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at);
    CREATE INDEX IF NOT EXISTS idx_analyses_url ON analyses(url);
    CREATE INDEX IF NOT EXISTS idx_quotas_ip_date ON quotas(ip_hash, date);
  `);

  console.log('Database initialized at:', DB_PATH);
  return db;
}

function getDb() {
  if (!db) initDb();
  return db;
}

// Analysis operations
function saveAnalysis({ url, title, summary, points, flashcards, quiz, userAgent, ip }) {
  const id = uuidv4();
  const ipHash = hashString(ip || 'anonymous');
  
  const stmt = db.prepare(`
    INSERT INTO analyses (id, url, title, summary, points, flashcards, quiz, user_agent, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, url, title, summary, JSON.stringify(points), JSON.stringify(flashcards), JSON.stringify(quiz), userAgent, ipHash);
  return id;
}

function getAnalysis(id) {
  const stmt = db.prepare('SELECT * FROM analyses WHERE id = ?');
  const row = stmt.get(id);
  if (row) {
    row.points = JSON.parse(row.points || '[]');
    row.flashcards = JSON.parse(row.flashcards || '[]');
    row.quiz = JSON.parse(row.quiz || '{}');
  }
  return row;
}

function getRecentAnalyses(limit = 20, offset = 0) {
  const stmt = db.prepare('SELECT id, url, title, created_at FROM analyses ORDER BY created_at DESC LIMIT ? OFFSET ?');
  return stmt.all(limit, offset);
}

// Simple hash for IP (privacy)
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Quota management (per IP, resets daily)
const DAILY_LIMIT = 30;

function checkUserQuota(ip) {
  const ipHash = hashString(ip);
  const today = new Date().toDateString();
  
  const stmt = db.prepare('SELECT * FROM quotas WHERE ip_hash = ? AND date = ?');
  const row = stmt.get(ipHash, today);
  
  if (!row) {
    return { allowed: true, remaining: DAILY_LIMIT, used: 0, resetAt: getTomorrow() };
  }
  
  return {
    allowed: row.count < DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - row.count),
    used: row.count,
    resetAt: getTomorrow()
  };
}

function incrementUserQuota(ip) {
  const ipHash = hashString(ip);
  const today = new Date().toDateString();
  
  const existing = db.prepare('SELECT * FROM quotas WHERE ip_hash = ? AND date = ?').get(ipHash, today);
  
  if (existing) {
    db.prepare('UPDATE quotas SET count = count + 1 WHERE ip_hash = ? AND date = ?').run(ipHash, today);
  } else {
    db.prepare('INSERT INTO quotas (ip_hash, date, count) VALUES (?, ?, 1)').run(ipHash, today);
  }
}

function getTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

module.exports = { initDb, getDb, saveAnalysis, getAnalysis, getRecentAnalyses, checkUserQuota, incrementUserQuota };
