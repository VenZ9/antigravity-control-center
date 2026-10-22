import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { CONFIG } from '../config.js';

let dbInstance = null;

export function getControlCenterDb() {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(CONFIG.DATA_DIR)) {
    fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
  }

  const dbPath = path.join(CONFIG.DATA_DIR, 'control_center.db');
  dbInstance = new DatabaseSync(dbPath);

  // Enable WAL mode for concurrency
  dbInstance.exec('PRAGMA journal_mode = WAL;');

  // Initialize tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS managed_sessions (
      id TEXT PRIMARY KEY,
      session_name TEXT NOT NULL,
      workspace_path TEXT NOT NULL,
      model TEXT,
      effort TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      last_error TEXT,
      conversation_id TEXT
    );

    CREATE TABLE IF NOT EXISTS session_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      stream_type TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES managed_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_session_logs_session_id ON session_logs(session_id);

    CREATE TABLE IF NOT EXISTS analytics_cache (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Initialize FTS5 index for conversation search
  try {
    dbInstance.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_conversations USING fts5(
        conversation_id UNINDEXED,
        title,
        preview,
        content
      );
    `);
  } catch (err) {
    console.warn('[DB] FTS5 initialization note:', err.message);
  }

  return dbInstance;
}

export function closeControlCenterDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
}
