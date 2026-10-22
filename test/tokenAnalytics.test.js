import test from 'node:test';
import assert from 'node:assert';
import { getTokenAnalytics } from '../server/services/tokenAnalyticsService.js';

test('Token Analytics: aggregates real local transcript records without fabricating data', () => {
  const analytics = getTokenAnalytics();

  assert.ok(analytics.grandTotal, 'Should have grandTotal object');
  assert.strictEqual(typeof analytics.grandTotal.input_tokens, 'number');
  assert.strictEqual(typeof analytics.grandTotal.output_tokens, 'number');
  assert.strictEqual(typeof analytics.grandTotal.cache_read_tokens, 'number');
  assert.strictEqual(analytics.source, 'local_transcripts');
  assert.ok(analytics.disclaimer.includes('local transcript'));

  assert.ok(Array.isArray(analytics.dailyUsage), 'dailyUsage should be array');
  assert.ok(Array.isArray(analytics.conversationRankings), 'conversationRankings should be array');

  // Verify mathematical consistency
  const calcTotal = analytics.grandTotal.input_tokens + analytics.grandTotal.output_tokens;
  assert.strictEqual(analytics.grandTotal.total_tokens, calcTotal);
});
