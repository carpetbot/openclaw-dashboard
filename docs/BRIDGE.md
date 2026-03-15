# Bridge Layer

The bridge is a Node.js server that runs on your Orange Pi (or any always-on machine). It is the heart of the system — it reads OpenClaw agent session files, maintains live state, and serves that state to the frontend over WebSocket.

---

## Files

```
bridge/
├── index.js     Express + WebSocket server, entry point
├── config.js    All configuration (agents, tools, budgets)
├── state.js     In-memory state store, event processor
├── watcher.js   JSONL file watcher
├── parser.js    Converts raw JSONL lines into typed events
└── gateway.js   Polls OpenClaw gateway CLI for health status
```

---

## index.js — Server Entry Point

Starts the HTTP server on port 3001 (or `$BRIDGE_PORT`), sets up REST endpoints and a WebSocket server, then kicks off the file watcher and gateway poller.

**REST Endpoints:**

| Method | Path | Returns |
|---|---|---|
| GET | `/api/state` | Full state snapshot |
| GET | `/api/health` | Bridge uptime, agent count, gateway status |
| GET | `/api/agents` | All agents with current status |
| GET | `/api/budget` | API usage per provider |
| GET | `/api/tools/recent` | Last 50 tool calls |
| GET | `/api/activity` | Last 100 activity log events |

**WebSocket at `/ws`:**
- On connect: sends `{ type: 'snapshot', data: {...} }`
- On state change: sends `{ type: 'state', data: {...} }`
- CORS enabled — any origin can connect

---

## config.js — Configuration

Central config file. Edit this to match your setup.

```js
export default {
  openclawHome: '~/.openclaw',   // where OpenClaw stores data

  agents: [
    { id: 'main', name: 'Main Agent', dir: 'main' },
    // Add more agents here
  ],

  featuredTools: [
    { pattern: /youtube|yt_scraper/i, name: 'YouTube Scraper', icon: '📺' },
    { pattern: /perplexity|web_search/i, name: 'Web Search', icon: '🌐' },
    // ...
  ],

  port: 3001,
  gatewayPollInterval: 10_000,  // ms
  idleThreshold: 60_000,        // ms — agent considered idle after this

  budgetLimits: {
    'anthropic': { monthlyUsd: 100, monthlyTokens: 5_000_000 },
    // ...
  },
};
```

See [CONFIGURATION.md](CONFIGURATION.md) for the full reference.

---

## state.js — State Store

The single source of truth. All components (watcher, gateway poller, WebSocket server) read from and write to this module.

**Key responsibilities:**
- Holds the full in-memory state object (agents, tools, budget, gateway, activityLog)
- `processEvent(event)` — updates state based on parsed events
- `getSnapshot()` — returns a copy of the current state
- `addListener(ws)` / `removeListener(ws)` — manages WebSocket clients
- `_broadcast()` — sends current state to all connected clients
- `updateGateway(data)` — called by gateway poller

**State updates by event type:**

| Event | State change |
|---|---|
| `session_start` | Agent → idle, log activity |
| `model_change` | Agent currentModel, currentProvider updated |
| `user_prompt` | Agent → working, taskPreview set |
| `agent_thinking` | Agent → working, budget accumulated |
| `tool_calls` | Agent → tool_use, added to activeTools, counts incremented |
| `tool_result` | Removed from activeTools, added to recent[], agent status updated |
| `usage_update` | Budget provider entry updated |

**Activity log** keeps the last 100 events. Each entry:
```js
{ type, agentId, agentName, message, timestamp }
```

---

## watcher.js — File System Monitor

Uses [chokidar](https://github.com/paulmillr/chokidar) to watch for new and changed JSONL files under each agent's sessions directory.

**Watched path per agent:**
```
~/.openclaw/agents/{dir}/sessions/*.jsonl
```

**Startup behavior:**
1. Finds the most recently modified `.jsonl` file for each agent
2. Reads the last 200 lines to hydrate initial state
3. Records the file's byte position in `filePositions` Map

**On file change:**
1. Reads only new bytes from the file (from last known position)
2. Splits into lines, parses each with `parser.js`
3. Calls `state.processEvent(event)` for each valid event

**On new file (`add` event):**
- A new session has started
- Parses the file from the beginning

**Idle detection:**
- Every 10 seconds, checks `Date.now() - agent.lastActive`
- If > `idleThreshold` (60s) and agent is working/tool_use, sets status to `idle`

---

## parser.js — Event Parser

Converts a raw JSONL line (string) into a structured event object.

**Input:** A single JSON string from a `.jsonl` session file

**OpenClaw JSONL format:**
```json
{ "type": "session", "timestamp": "...", "version": "1.2.3", "sessionId": "..." }
{ "type": "model_change", "timestamp": "...", "provider": "anthropic", "model": "claude-3-5-sonnet" }
{ "type": "message", "timestamp": "...", "message": { "role": "...", "content": [...] } }
```

**Message content blocks:**
```json
// Tool call
{ "type": "toolCall", "id": "call_abc", "name": "web_search", "arguments": {...} }

// Text response
{ "type": "text", "text": "Based on my research..." }

// Tool result
{ "type": "toolResult", "toolUseId": "call_abc", "content": "...", "isError": false }
```

**Tool classification:**

Each tool name is matched against `config.featuredTools` patterns. If no match, falls back to `{ name: 'Tools', icon: '🔧' }`.

```js
// Example: tool name "yt_scraper_run" matches /youtube|yt_scraper/i
// → station: { name: 'YouTube Scraper', icon: '📺' }
```

**Routing logic:**

```
JSONL line
  ├─ type === 'session'             → session_start event
  ├─ type === 'model_change'        → model_change event
  ├─ type === 'thinking_level_change' → thinking_change event
  └─ type === 'message'
       ├─ role === 'assistant'
       │    ├─ has toolCall blocks  → tool_calls event
       │    ├─ has text blocks      → agent_thinking event
       │    └─ usage only           → usage_update event
       ├─ role === 'tool'
       │    └─ has toolResult blocks → tool_result event
       └─ role === 'user'           → user_prompt event
```

---

## gateway.js — Gateway Health Poller

Polls the OpenClaw CLI every 10 seconds to report gateway health.

**Commands used:**
```bash
openclaw gateway status   # → parse PID, port, telegram info
openclaw --version        # → parse version string
```

**Parsed fields:**

| Field | Source |
|---|---|
| `status` | "Runtime: running/stopped" |
| `pid` | "pid 12345" |
| `port` | "Listening: 0.0.0.0:8080" |
| `version` | "openclaw/1.2.3" |
| `telegram.connected` | "@botname" present in output |
| `telegram.bot` | "@botname" extracted |

If the command fails or times out, `status` is set to `'unknown'`.

Calls `state.updateGateway(data)` after each poll, which triggers a broadcast to all WebSocket clients.
