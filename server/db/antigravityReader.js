import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { CONFIG } from '../config.js';

export function getAntigravitySummariesDb() {
  const dbPath = path.join(CONFIG.AGY_DIR, 'conversation_summaries.db');
  if (!fs.existsSync(dbPath)) {
    return null;
  }
  // Open strictly read-only
  try {
    return new DatabaseSync(dbPath, { readOnly: true });
  } catch (err) {
    console.error(`[AgyReader] Failed to open conversation_summaries.db: ${err.message}`);
    return null;
  }
}

export function listConversationSummaries(options = {}) {
  const db = getAntigravitySummariesDb();
  if (!db) return [];

  try {
    let query = `
      SELECT 
        conversation_id,
        title,
        preview,
        step_count,
        last_modified_time,
        workspace_uris,
        status,
        source,
        project_id,
        agent_name,
        parent_conversation_id,
        nesting_depth,
        battle_id,
        winning_conversation_id,
        not_fully_idle,
        killed,
        last_user_input_time,
        last_user_input_step_index,
        app_data_dir,
        group_id
      FROM conversation_summaries
    `;

    const conditions = [];
    const params = [];

    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    if (options.agent) {
      conditions.push('agent_name = ?');
      params.push(options.agent);
    }
    if (options.workspace) {
      conditions.push('workspace_uris LIKE ?');
      params.push(`%${options.workspace}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const sortField = options.sortBy === 'step_count' ? 'step_count' : 'last_modified_time';
    const sortOrder = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    if (options.limit) {
      query += ` LIMIT ${parseInt(options.limit, 10)}`;
      if (options.offset) {
        query += ` OFFSET ${parseInt(options.offset, 10)}`;
      }
    }

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    return rows;
  } catch (err) {
    console.error('[AgyReader] Query error:', err);
    return [];
  } finally {
    try {
      db.close();
    } catch {}
  }
}

export function getConversationSummaryById(conversationId) {
  const db = getAntigravitySummariesDb();
  if (!db) return null;

  try {
    const stmt = db.prepare(`
      SELECT 
        conversation_id,
        title,
        preview,
        step_count,
        last_modified_time,
        workspace_uris,
        status,
        source,
        project_id,
        agent_name,
        parent_conversation_id,
        nesting_depth,
        battle_id,
        winning_conversation_id,
        not_fully_idle,
        killed,
        last_user_input_time,
        last_user_input_step_index,
        app_data_dir,
        group_id
      FROM conversation_summaries
      WHERE conversation_id = ?
    `);
    const row = stmt.get(conversationId);
    return row || null;
  } catch (err) {
    console.error(`[AgyReader] Query by id error: ${err.message}`);
    return null;
  } finally {
    try {
      db.close();
    } catch {}
  }
}
