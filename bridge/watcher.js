// watcher.js — Watches OpenClaw session JSONL files for new events
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import chokidar from 'chokidar';
import config from './config.js';
import { parseEvent } from './parser.js';
import state from './state.js';

const resolvedHome = config.openclawHome.replace('~', homedir());

// Track file read positions so we only parse new lines
const filePositions = new Map();

/**
 * Read new lines from a JSONL file starting from last known position
 */
function readNewLines(filePath, agentId) {
  const lastPos = filePositions.get(filePath) || 0;
  const stat = fs.statSync(filePath);

  if (stat.size <= lastPos) return;

  const stream = fs.createReadStream(filePath, {
    start: lastPos,
    encoding: 'utf-8',
  });

  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete last line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = parseEvent(line, agentId);
      if (event) {
        state.processEvent(event);
      }
    }
  });

  stream.on('end', () => {
    filePositions.set(filePath, stat.size);
  });

  stream.on('error', (err) => {
    console.error(`[watcher] Error reading ${filePath}:`, err.message);
  });
}

/**
 * On initial load, scan the most recent session file for each agent
 * to populate current state
 */
function loadLatestSession(agentId, agentDir) {
  const sessionsDir = path.join(agentDir, 'sessions');
  if (!fs.existsSync(sessionsDir)) {
    console.log(`[watcher] No sessions dir for agent ${agentId}: ${sessionsDir}`);
    return;
  }

  const files = fs.readdirSync(sessionsDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      path: path.join(sessionsDir, f),
      mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    console.log(`[watcher] No session files for agent ${agentId}`);
    return;
  }

  // Load only the most recent session (last 200 lines for context)
  const latestFile = files[0];
  console.log(`[watcher] Loading latest session for ${agentId}: ${latestFile.name}`);

  const content = fs.readFileSync(latestFile.path, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  // Parse last 200 lines to populate state (agent status, usage, etc.)
  const recentLines = lines.slice(-200);
  for (const line of recentLines) {
    const event = parseEvent(line, agentId);
    if (event) {
      state.processEvent(event);
    }
  }

  // Set file position to end so we only get new events going forward
  const stat = fs.statSync(latestFile.path);
  filePositions.set(latestFile.path, stat.size);
  console.log(`[watcher] Agent ${agentId}: loaded ${recentLines.length} events, watching for new`);
}

/**
 * Start watching all agent session directories
 */
export function startWatching() {
  for (const agent of config.agents) {
    const agentDir = path.join(resolvedHome, 'agents', agent.dir);
    const sessionsDir = path.join(agentDir, 'sessions');

    if (!fs.existsSync(agentDir)) {
      console.warn(`[watcher] Agent dir not found: ${agentDir} — skipping ${agent.id}`);
      continue;
    }

    // Load existing state from latest session
    loadLatestSession(agent.id, agentDir);

    // Ensure sessions directory exists
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    // Watch for changes
    const watcher = chokidar.watch(path.join(sessionsDir, '*.jsonl'), {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300 },
    });

    watcher.on('change', (filePath) => {
      readNewLines(filePath, agent.id);
    });

    watcher.on('add', (filePath) => {
      console.log(`[watcher] New session file for ${agent.id}: ${path.basename(filePath)}`);
      filePositions.set(filePath, 0);
      readNewLines(filePath, agent.id);
    });

    watcher.on('error', (err) => {
      console.error(`[watcher] Error watching ${agent.id}:`, err.message);
    });

    console.log(`[watcher] Watching ${sessionsDir} for agent ${agent.id}`);
  }

  // Periodic idle check
  setInterval(() => {
    state.checkIdleAgents();
  }, 10_000);

  console.log('[watcher] File watcher started');
}
