// index.js — OpenClaw Dashboard Bridge
// Runs on the Pi, serves real-time state to the frontend via WebSocket + REST

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import config from './config.js';
import state from './state.js';
import { startWatching } from './watcher.js';
import { startGatewayPoller } from './gateway.js';

const app = express();
app.use(cors());

// ---- REST endpoints ----

// Full state snapshot (initial load)
app.get('/api/state', (req, res) => {
  res.json(state.getSnapshot());
});

// Health check (for Cloudflare Tunnel / monitoring)
app.get('/api/health', (req, res) => {
  res.json({
    bridge: 'running',
    agents: Object.keys(state.agents).length,
    gateway: state.gateway.status,
    uptime: process.uptime(),
  });
});

// Agent list
app.get('/api/agents', (req, res) => {
  res.json(state.agents);
});

// Budget summary
app.get('/api/budget', (req, res) => {
  res.json(state.budget);
});

// Recent tool calls
app.get('/api/tools/recent', (req, res) => {
  res.json(state.tools.recent);
});

// Activity log
app.get('/api/activity', (req, res) => {
  res.json(state.activityLog);
});

// ---- WebSocket for real-time updates ----

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('[ws] Client connected');

  // Send initial snapshot
  ws.send(JSON.stringify({ type: 'snapshot', data: state.getSnapshot() }));

  // Register for live updates
  state.addListener(ws);

  ws.on('close', () => {
    console.log('[ws] Client disconnected');
    state.removeListener(ws);
  });

  ws.on('error', (err) => {
    console.error('[ws] Error:', err.message);
    state.removeListener(ws);
  });
});

// ---- Start everything ----

server.listen(config.port, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║       OpenClaw Dashboard Bridge          ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  REST API:    http://localhost:${config.port}/api/state`);
  console.log(`  WebSocket:   ws://localhost:${config.port}/ws`);
  console.log(`  Health:      http://localhost:${config.port}/api/health`);
  console.log('');
  console.log(`  Watching ${config.agents.length} agent(s):`);
  for (const agent of config.agents) {
    console.log(`    → ${agent.name} (${agent.dir})`);
  }
  console.log('');

  // Start file watcher (agent events)
  startWatching();

  // Start gateway health poller
  startGatewayPoller();
});
