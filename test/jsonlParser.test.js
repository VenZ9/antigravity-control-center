import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseJsonlFile } from '../server/services/conversationService.js';

test('JSONL Parser: handles valid lines and partial corrupt lines gracefully', () => {
  const tmpDir = os.tmpdir();
  const testFile = path.join(tmpDir, `test_transcript_${Date.now()}.jsonl`);

  const sampleData = [
    JSON.stringify({ step_index: 0, type: 'USER_INPUT', content: 'Hello agent' }),
    '{"step_index": 1, "type": "PLANNER_RESPONSE", "input_tokens": 100', // corrupt/truncated line
    JSON.stringify({ step_index: 2, type: 'GENERIC', content: 'Step completed' })
  ].join('\n');

  fs.writeFileSync(testFile, sampleData);

  const results = parseJsonlFile(testFile);
  assert.strictEqual(results.length, 3, 'Should parse all 3 lines without throwing');

  assert.strictEqual(results[0].step_index, 0);
  assert.strictEqual(results[0].content, 'Hello agent');

  // Second line should have parse_error flag
  assert.strictEqual(results[1].parse_error, true);
  assert.ok(results[1].raw.includes('PLANNER_RESPONSE'));

  assert.strictEqual(results[2].step_index, 2);
  assert.strictEqual(results[2].content, 'Step completed');

  fs.unlinkSync(testFile);
});
