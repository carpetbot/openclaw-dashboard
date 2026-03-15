// state.js — Maintains the live dashboard state
import config from './config.js';

const MAX_TOOL_HISTORY = 50;
const MAX_ACTIVITY_LOG = 100;

class DashboardState {
  constructor() {
    // Agent states
    this.agents = {};
    for (const agent of config.agents) {
      this.agents[agent.id] = {
        id: agent.id,
        name: agent.name,
        status: 'offline',        // offline | idle | working | tool_use | error
        currentTool: null,         // { name, station, callId } or null
        currentModel: null,
        currentProvider: null,
        lastActive: null,
        lastSessionId: null,
        taskPreview: '',           // last user prompt snippet
      };
    }

    // Tool usage tracking
    this.tools = {
      recent: [],                  // last N tool calls with results
      counts: {},                  // { toolName: count }
      stationCounts: {},           // { stationName: count }
      activeTools: {},             // { callId: { agentId, name, station, startTime } }
    };

    // API budget tracking (per provider, resets monthly)
    this.budget = {};
    // Initialize from config
    for (const [provider, limits] of Object.entries(config.budgetLimits)) {
      this.budget[provider] = {
        provider,
        tokensUsed: 0,
        costUsd: 0,
        limits,
        callCount: 0,
        lastUsed: null,
      };
    }

    // Gateway health
    this.gateway = {
      status: 'unknown',          // running | stopped | unknown
      pid: null,
      port: null,
      version: null,
      telegram: { connected: false, bot: null },
      uptime: null,
      lastChecked: null,
    };

    // Activity log (recent events for the feed)
    this.activityLog = [];

    // Listeners
    this._listeners = new Set();
  }

  /**
   * Process a parsed event and update state
   */
  processEvent(event) {
    if (!event) return;

    switch (event.kind) {
      case 'session_start':
        this._updateAgent(event.agentId, {
          status: 'idle',
          lastSessionId: event.sessionId,
          lastActive: event.timestamp,
        });
        this._log('session', event.agentId, `New session started`);
        break;

      case 'model_change':
        this._updateAgent(event.agentId, {
          currentModel: event.model,
          currentProvider: event.provider,
        });
        break;

      case 'user_prompt':
        this._updateAgent(event.agentId, {
          status: 'working',
          taskPreview: event.preview,
          lastActive: event.timestamp,
        });
        this._log('prompt', event.agentId, event.preview);
        break;

      case 'agent_thinking':
        this._updateAgent(event.agentId, {
          status: 'working',
          lastActive: event.timestamp,
        });
        if (event.usage) this._trackUsage(event);
        break;

      case 'tool_calls':
        for (const tool of event.tools) {
          this.tools.activeTools[tool.callId] = {
            agentId: event.agentId,
            name: tool.name,
            station: tool.station,
            startTime: event.timestamp,
            arguments: tool.arguments,
          };
          this.tools.counts[tool.name] = (this.tools.counts[tool.name] || 0) + 1;
          this.tools.stationCounts[tool.station.name] =
            (this.tools.stationCounts[tool.station.name] || 0) + 1;
        }
        const firstTool = event.tools[0];
        this._updateAgent(event.agentId, {
          status: 'tool_use',
          currentTool: {
            name: firstTool.name,
            station: firstTool.station,
            callId: firstTool.callId,
          },
          lastActive: event.timestamp,
        });
        if (event.usage) this._trackUsage(event);
        this._log('tool', event.agentId,
          `Using ${firstTool.station.icon} ${firstTool.name}`);
        break;

      case 'tool_result': {
        const active = this.tools.activeTools[event.callId];
        const duration = active
          ? new Date(event.timestamp) - new Date(active.startTime)
          : null;

        this.tools.recent.unshift({
          agentId: event.agentId,
          name: event.toolName,
          station: event.station,
          isError: event.isError,
          duration,
          timestamp: event.timestamp,
        });
        if (this.tools.recent.length > MAX_TOOL_HISTORY) {
          this.tools.recent.pop();
        }
        delete this.tools.activeTools[event.callId];

        // If no more active tools for this agent, back to working
        const agentHasActiveTools = Object.values(this.tools.activeTools)
          .some(t => t.agentId === event.agentId);

        this._updateAgent(event.agentId, {
          status: agentHasActiveTools ? 'tool_use' : 'working',
          currentTool: agentHasActiveTools
            ? this.agents[event.agentId]?.currentTool
            : null,
          lastActive: event.timestamp,
        });

        if (event.isError) {
          this._log('error', event.agentId,
            `${event.station.icon} ${event.toolName} failed`);
        }
        break;
      }

      case 'usage_update':
        if (event.usage) this._trackUsage(event);
        break;
    }

    this._broadcast();
  }

  /**
   * Update gateway health from poll results
   */
  updateGateway(gatewayData) {
    this.gateway = { ...this.gateway, ...gatewayData, lastChecked: new Date().toISOString() };
    this._broadcast();
  }

  /**
   * Check for idle agents (no activity within threshold)
   */
  checkIdleAgents() {
    const now = Date.now();
    for (const [id, agent] of Object.entries(this.agents)) {
      if (agent.status === 'working' || agent.status === 'tool_use') {
        if (agent.lastActive) {
          const elapsed = now - new Date(agent.lastActive).getTime();
          if (elapsed > config.idleThreshold) {
            this._updateAgent(id, { status: 'idle', currentTool: null });
          }
        }
      }
    }
  }

  /**
   * Get the full state snapshot (for initial load)
   */
  getSnapshot() {
    return {
      agents: this.agents,
      tools: {
        recent: this.tools.recent,
        counts: this.tools.counts,
        stationCounts: this.tools.stationCounts,
      },
      budget: this.budget,
      gateway: this.gateway,
      activityLog: this.activityLog,
      timestamp: new Date().toISOString(),
    };
  }

  // --- Internal helpers ---

  _updateAgent(agentId, updates) {
    if (!this.agents[agentId]) {
      // Auto-register unknown agents
      this.agents[agentId] = {
        id: agentId,
        name: agentId,
        status: 'offline',
        currentTool: null,
        currentModel: null,
        currentProvider: null,
        lastActive: null,
        lastSessionId: null,
        taskPreview: '',
      };
    }
    Object.assign(this.agents[agentId], updates);
  }

  _trackUsage(event) {
    const provider = event.provider;
    if (!provider || !event.usage) return;

    if (!this.budget[provider]) {
      this.budget[provider] = {
        provider,
        tokensUsed: 0,
        costUsd: 0,
        limits: config.budgetLimits[provider] || { monthlyUsd: 100, monthlyTokens: 5_000_000 },
        callCount: 0,
        lastUsed: null,
      };
    }

    const b = this.budget[provider];
    b.tokensUsed += event.usage.totalTokens || 0;
    b.costUsd += event.usage.cost?.total || 0;
    b.callCount += 1;
    b.lastUsed = event.timestamp;
  }

  _log(type, agentId, message) {
    this.activityLog.unshift({
      type,
      agentId,
      agentName: this.agents[agentId]?.name || agentId,
      message,
      timestamp: new Date().toISOString(),
    });
    if (this.activityLog.length > MAX_ACTIVITY_LOG) {
      this.activityLog.pop();
    }
  }

  // --- WebSocket broadcast ---

  addListener(ws) {
    this._listeners.add(ws);
  }

  removeListener(ws) {
    this._listeners.delete(ws);
  }

  _broadcast() {
    const snapshot = JSON.stringify({ type: 'state', data: this.getSnapshot() });
    for (const ws of this._listeners) {
      try {
        if (ws.readyState === 1) ws.send(snapshot);
      } catch {
        this._listeners.delete(ws);
      }
    }
  }
}

export default new DashboardState();
