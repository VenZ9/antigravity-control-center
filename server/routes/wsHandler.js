import { WebSocketServer } from 'ws';
import { verifyWsOrigin } from '../security/guards.js';
import { monitorEvents } from '../services/liveMonitorService.js';
import { sessionEvents } from '../services/sessionManager.js';

export function setupWebSocketServer(httpServer, config) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const origin = request.headers['origin'];
    if (!verifyWsOrigin(origin, config.HOST, config.PORT)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  const broadcast = (type, payload) => {
    const msg = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    for (const client of wss.clients) {
      if (client.readyState === 1) { // OPEN
        try {
          client.send(msg);
        } catch {}
      }
    }
  };

  // Wire up event emitters to WebSocket broadcast
  monitorEvents.on('snapshot_update', (snapshot) => {
    broadcast('snapshot_update', snapshot);
  });

  monitorEvents.on('active_session_change', (data) => {
    broadcast('active_session_change', data);
  });

  sessionEvents.on('session_output', (data) => {
    broadcast('session_output', data);
  });

  sessionEvents.on('session_status', (data) => {
    broadcast('session_status', data);
  });

  sessionEvents.on('session_turn_start', (data) => {
    broadcast('session_turn_start', data);
  });

  sessionEvents.on('session_turn_result', (data) => {
    broadcast('session_turn_result', data);
  });

  sessionEvents.on('session_init', (data) => {
    broadcast('session_init', data);
  });

  sessionEvents.on('session_step_update', (data) => {
    broadcast('session_step_update', data);
  });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {}
    });

    // Send initial connection ack
    ws.send(JSON.stringify({
      type: 'connected',
      payload: { message: 'Connected to Antigravity Control Center WS' }
    }));
  });

  // Keepalive interval
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}
