import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { sanitizeUserMessage } from '../src/utils/sanitize.ts';
import { CONFIG } from '../server/config.js';

test('Sanitization: strips <USER_REQUEST> tags correctly', () => {
  const raw = '<USER_REQUEST>\nGood morning\n</USER_REQUEST>';
  const result = sanitizeUserMessage(raw);
  assert.strictEqual(result.text, 'Good morning');
  assert.deepStrictEqual(result.attachments, []);
});

test('Sanitization: strips <ADDITIONAL_METADATA> and leaves clean text', () => {
  const raw = `<USER_REQUEST>
Good morning
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: Thu Oct 22 2026 10:30:00 GMT+0000
</ADDITIONAL_METADATA>`;

  const result = sanitizeUserMessage(raw);
  assert.strictEqual(result.text, 'Good morning');
  assert.deepStrictEqual(result.attachments, []);
});

test('Sanitization: strips <SYSTEM_MESSAGE> correctly', () => {
  const raw = `<SYSTEM_MESSAGE>
[Message] timestamp=2026-10-22T05:00:00Z sender=system content=Session initialized
</SYSTEM_MESSAGE>
Hello assistant!`;

  const result = sanitizeUserMessage(raw);
  assert.strictEqual(result.text, 'Hello assistant!');
});

test('Sanitization: extracts attachment paths from injected attachment header', () => {
  const raw = `The user has attached the following files. Use your tools to inspect them:
- /data/data/com.termux/files/home/antigravity-control-center/uploads/report.pdf
- /data/data/com.termux/files/home/antigravity-control-center/uploads/screenshot.png

Can you summarize this report and check the screenshot?`;

  const result = sanitizeUserMessage(raw);
  assert.strictEqual(result.text, 'Can you summarize this report and check the screenshot?');
  assert.strictEqual(result.attachments.length, 2);
  assert.strictEqual(result.attachments[0].name, 'report.pdf');
  assert.strictEqual(result.attachments[0].path, '/data/data/com.termux/files/home/antigravity-control-center/uploads/report.pdf');
  assert.strictEqual(result.attachments[1].name, 'screenshot.png');
  assert.strictEqual(result.attachments[1].path, '/data/data/com.termux/files/home/antigravity-control-center/uploads/screenshot.png');
});

test('Sanitization: extracts attachments wrapped inside <USER_REQUEST>', () => {
  const raw = `<USER_REQUEST>
The user has attached the following files. Use your tools to inspect them:
- /home/project/data.json

Please parse this file.
</USER_REQUEST>
<ADDITIONAL_METADATA>
Some metadata here
</ADDITIONAL_METADATA>`;

  const result = sanitizeUserMessage(raw);
  assert.strictEqual(result.text, 'Please parse this file.');
  assert.strictEqual(result.attachments.length, 1);
  assert.strictEqual(result.attachments[0].name, 'data.json');
  assert.strictEqual(result.attachments[0].path, '/home/project/data.json');
});

test('Sanitization: handles null, undefined, and empty string safely', () => {
  assert.strictEqual(sanitizeUserMessage(null).text, '(Empty prompt)');
  assert.strictEqual(sanitizeUserMessage(undefined).text, '(Empty prompt)');
  assert.strictEqual(sanitizeUserMessage('').text, '(Empty prompt)');
  assert.strictEqual(sanitizeUserMessage('   ').text, '(Empty prompt)');
});

test('Sanitization: extracts Windows backslash attachment paths correctly', () => {
  const raw = `The user has attached the following files. Use your tools to inspect them:
- C:\\Users\\Developer\\antigravity-control-center\\uploads\\diagram.png

Inspect this architecture diagram.`;

  const result = sanitizeUserMessage(raw);
  assert.strictEqual(result.text, 'Inspect this architecture diagram.');
  assert.strictEqual(result.attachments.length, 1);
  assert.strictEqual(result.attachments[0].name, 'diagram.png');
  assert.strictEqual(result.attachments[0].path, 'C:\\Users\\Developer\\antigravity-control-center\\uploads\\diagram.png');
});

test('Uploads Directory: configured under project root', () => {
  assert.ok(CONFIG.UPLOADS_DIR);
  assert.ok(CONFIG.UPLOADS_DIR.includes('uploads'));
  const resolved = path.resolve(CONFIG.UPLOADS_DIR);
  assert.strictEqual(resolved, CONFIG.UPLOADS_DIR);
});
