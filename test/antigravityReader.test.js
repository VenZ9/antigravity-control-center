import test from 'node:test';
import assert from 'node:assert';
import { listConversationSummaries, getConversationSummaryById } from '../server/db/antigravityReader.js';

test('Antigravity Reader: reads summaries in read-only mode', () => {
  const summaries = listConversationSummaries({ limit: 5 });
  assert.ok(Array.isArray(summaries), 'Summaries should be an array');
  assert.ok(summaries.length > 0, 'Should find existing conversation summaries');

  const first = summaries[0];
  assert.ok(first.conversation_id, 'Should have conversation_id');
  assert.ok(typeof first.step_count === 'number', 'step_count should be a number');
  assert.ok(first.status, 'status should exist');
});

test('Antigravity Reader: query by id works', () => {
  const list = listConversationSummaries({ limit: 1 });
  assert.ok(list.length > 0);
  const target = list[0].conversation_id;

  const summary = getConversationSummaryById(target);
  assert.ok(summary);
  assert.strictEqual(summary.conversation_id, target);
});
