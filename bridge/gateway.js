// gateway.js — Polls OpenClaw gateway health
import { execSync } from 'child_process';
import config from './config.js';
import state from './state.js';

function parseGatewayStatus(output) {
  const data = {
    status: 'unknown',
    pid: null,
    port: null,
    version: null,
    telegram: { connected: false, bot: null },
    uptime: null,
  };

  try {
    // Parse "Runtime: running (pid 14687, ...)"
    const runtimeMatch = output.match(/Runtime:\s*(running|stopped|inactive)/i);
    if (runtimeMatch) data.status = runtimeMatch[1].toLowerCase();

    const pidMatch = output.match(/pid\s+(\d+)/);
    if (pidMatch) data.pid = parseInt(pidMatch[1]);

    // Parse "Listening: 127.0.0.1:18789"
    const portMatch = output.match(/Listening:\s*[\d.]+:(\d+)/);
    if (portMatch) data.port = parseInt(portMatch[1]);

    // Check for Telegram references
    if (output.includes('telegram')) {
      data.telegram.connected = !output.includes('telegram') || !output.includes('error');
      const botMatch = output.match(/@(\w+_bot)/);
      if (botMatch) data.telegram.bot = `@${botMatch[1]}`;
    }
  } catch (err) {
    // Parsing failure, keep defaults
  }

  return data;
}

function getVersion() {
  try {
    const output = execSync('openclaw --version', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    return output;
  } catch {
    return null;
  }
}

function checkGateway() {
  try {
    const output = execSync('openclaw gateway status', {
      encoding: 'utf-8',
      timeout: 10_000,
    });

    const gatewayData = parseGatewayStatus(output);
    gatewayData.version = getVersion();
    state.updateGateway(gatewayData);

  } catch (err) {
    // Gateway command failed — likely stopped
    state.updateGateway({
      status: 'stopped',
      pid: null,
      version: getVersion(),
    });
  }
}

/**
 * Start periodic gateway health polling
 */
export function startGatewayPoller() {
  // Initial check
  checkGateway();

  // Poll on interval
  setInterval(checkGateway, config.gatewayPollInterval);
  console.log(`[gateway] Health poller started (every ${config.gatewayPollInterval / 1000}s)`);
}
