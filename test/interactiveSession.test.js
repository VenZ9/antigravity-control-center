import test from 'node:test';
import assert from 'node:assert';
import {
  createManagedSession,
  sendMessageToSession,
  stopManagedSession,
  getManagedSession,
  listManagedSessions
} from '../server/services/sessionManager.js';

test('Interactive Session: rejects empty or non-string message input', async () => {
  await assert.rejects(
    async () => {
      await sendMessageToSession('non-existent-id', '');
    },
    { message: 'Message content is required' }
  );

  await assert.rejects(
    async () => {
      await sendMessageToSession('non-existent-id', null);
    },
    { message: 'Message content is required' }
  );
});

test('Interactive Session: gracefully handles non-existent session for message sending', async () => {
  await assert.rejects(
    async () => {
      await sendMessageToSession('00000000-0000-0000-0000-000000000000', 'hello');
    },
    { message: 'Session not found' }
  );
});

test('Interactive Session: lists managed sessions and tracks active process state', () => {
  const sessions = listManagedSessions();
  assert.ok(Array.isArray(sessions));
  for (const s of sessions) {
    assert.ok(typeof s.isActiveProcess === 'boolean');
  }
});
