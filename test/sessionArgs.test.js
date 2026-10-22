import test from 'node:test';
import assert from 'node:assert';
import { resolveModelArgs, MODEL_SLUG_MAP } from '../server/services/sessionManager.js';

test('Session Runner Model Mapping: converts display labels to exact CLI slugs', () => {
  const models = [
    { label: 'Gemini 3.8 Flash (High)', expected: 'gemini-3.8-flash-high' },
    { label: 'Gemini 3.8 Flash (Medium)', expected: 'gemini-3.8-flash-medium' },
    { label: 'Gemini 3.8 Flash (Low)', expected: 'gemini-3.8-flash-low' },
    { label: 'Claude Sonnet 4.6 (Thinking)', expected: 'claude-sonnet-4-6' },
    { label: 'Claude Opus 4.6 (Thinking)', expected: 'claude-opus-4-6-thinking' },
    { label: 'GPT-OSS 120B (Medium)', expected: 'gpt-oss-120b-medium' }
  ];

  for (const item of models) {
    const args = resolveModelArgs(item.label, 'high');
    assert.deepStrictEqual(args, ['--model', item.expected], `Model ${item.label} should resolve without invalid --effort`);
  }
});

test('Session Runner Model Mapping: supports base model with effort flag when supported', () => {
  const args = resolveModelArgs('gemini-3.8-flash', 'high');
  assert.deepStrictEqual(args, ['--model', 'gemini-3.8-flash', '--effort', 'high']);
});

test('Session Runner Model Mapping: handles null/empty model safely', () => {
  assert.deepStrictEqual(resolveModelArgs(null), []);
  assert.deepStrictEqual(resolveModelArgs(''), []);
});
