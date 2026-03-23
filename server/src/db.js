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

module.exports = { initDb, getDb, saveAnalysis, getAnalysis, getRecentAnalyses };
