import test from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import { validateSettings, getSettings } from '../server/services/settingsService.js';

test('Settings Service: validates valid settings payload', () => {
  const payload = {
    model: 'Gemini 3.8 Flash (High)',
    editor: 'vim',
    editorMode: 'vim',
    trustedWorkspaces: [os.homedir()],
    useTerminalCursor: true,
    seasonalThemesOff: false
  };

  const res = validateSettings(payload);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.errors.length, 0);
  assert.strictEqual(res.cleaned.model, 'Gemini 3.8 Flash (High)');
  assert.strictEqual(res.cleaned.editorMode, 'vim');
});

test('Settings Service: rejects invalid types and bad modes', () => {
  const invalidPayload = {
    model: '', // empty
    editorMode: 'not-a-valid-mode',
    trustedWorkspaces: 'not an array'
  };

  const res = validateSettings(invalidPayload);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.length >= 3);
});

test('Settings Service: reads current settings safely', () => {
  const current = getSettings();
  assert.ok(current.exists);
  assert.ok(current.settings);
  assert.ok(Array.isArray(current.supportedModels));
  assert.ok(current.supportedModels.includes('Gemini 3.8 Flash (High)'));
});
