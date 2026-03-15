# API Reference

The bridge exposes both a REST API and a WebSocket endpoint.

Base URL (local): `http://localhost:3001`
Base URL (via tunnel): `https://your-tunnel-url`

---

## REST Endpoints

### GET /api/health

Bridge health check. Use this to verify the bridge is running.

**Response:**
```json
{
  "bridge": "running",
  "agents": 1,
  "gateway": "running",
  "uptime": 3612.4
}
```

| Field | Type | Description |
|---|---|---|
| `bridge` | string | Always `"running"` if reachable |
| `agents` | number | Number of configured agents |
| `gateway` | string | Last known gateway status |
| `uptime` | number | Bridge process uptime in seconds |

---

### GET /api/state

Full dashboard state snapshot. This is the same object the WebSocket sends on connect.

**Response:** See [State Shape](#state-shape) below.

---

### GET /api/agents

Current status of all agents.

**Response:**
```json
{
  "main": {
    "id": "main",
    "name": "Main Agent",
    "status": "working",
    "currentTool": {
      "name": "web_search",
      "station": { "name": "Web Search", "icon": "🌐" },
      "callId": "call_abc123"
    },
    "currentModel": "claude-3-5-sonnet",
    "currentProvider": "anthropic",
    "lastActive": "2024-03-15T12:30:45.123Z",
    "lastSessionId": "session-20240315-120000",
    "taskPreview": "Research the latest earnings reports for Apple"
  }
}
```

---

### GET /api/budget

API usage grouped by provider.

**Response:**
```json
{
  "anthropic": {
    "provider": "anthropic",
    "tokensUsed": 142500,
    "costUsd": 4.28,
    "limits": { "monthlyUsd": 100, "monthlyTokens": 5000000 },
    "callCount": 38,
    "lastUsed": "2024-03-15T12:30:45.123Z"
  }
}
```

---

### GET /api/tools/recent

Last 50 tool calls across all agents.

**Response:**
```json
[
  {
    "agentId": "main",
    "name": "web_search",
    "station": { "name": "Web Search", "icon": "🌐" },
    "isError": false,
    "duration": 1240,
    "timestamp": "2024-03-15T12:30:44.000Z"
  }
]
```

`duration` is in milliseconds. It is `null` if the tool result hasn't been received yet.

---

### GET /api/activity

Last 100 activity log entries.

**Response:**
```json
[
  {
    "type": "tool_calls",
    "agentId": "main",
    "agentName": "Main Agent",
    "message": "Using Web Search",
    "timestamp": "2024-03-15T12:30:45.123Z"
  }
]
```

Activity `type` values: `session_start`, `user_prompt`, `tool_calls`, `tool_result`, `model_change`, `agent_idle`.

---

## WebSocket — /ws

Connect with any WebSocket client:
```
ws://localhost:3001/ws
wss://your-tunnel-url/ws
```

### Messages from Bridge → Client

**On connect** (type: `snapshot`):
```json
{
  "type": "snapshot",
  "data": { ...full state... }
}
```

**On every state change** (type: `state`):
```json
{
  "type": "state",
  "data": { ...full state... }
}
```

Both carry the complete state. Replace your local state entirely on each message.

The bridge sends a new message whenever:
- Any JSONL file changes (new events from agents)
- The gateway poller updates gateway status (every 10s)
- An agent is marked idle (every 10s check)

---

## State Shape

Full state object returned by `/api/state` and the WebSocket:

```typescript
{
  agents: {
    [agentId: string]: {
      id: string
      name: string
      status: 'offline' | 'idle' | 'working' | 'tool_use' | 'error'
      currentTool: {
        name: string
        station: { name: string; icon: string }
        callId: string
      } | null
      currentModel: string | null
      currentProvider: string | null
      lastActive: string | null        // ISO8601
      lastSessionId: string | null
      taskPreview: string | null       // First 120 chars of last prompt
    }
  }

  tools: {
    recent: Array<{
      agentId: string
      name: string
      station: { name: string; icon: string }
      isError: boolean
      duration: number | null          // milliseconds
      timestamp: string                // ISO8601
    }>                                 // Last 50

    counts: { [toolName: string]: number }
    stationCounts: { [stationName: string]: number }

    activeTools: {
      [callId: string]: {
        agentId: string
        name: string
        station: { name: string; icon: string }
        startTime: string              // ISO8601
        arguments: object
      }
    }
  }

  budget: {
    [provider: string]: {
      provider: string
      tokensUsed: number
      costUsd: number
      limits: { monthlyUsd: number; monthlyTokens: number } | null
      callCount: number
      lastUsed: string | null          // ISO8601
    }
  }

  gateway: {
    status: 'running' | 'stopped' | 'unknown'
    pid: number | null
    port: number | null
    version: string | null
    telegram: {
      connected: boolean
      bot: string | null               // e.g. "@my_bot"
    }
    uptime: number | null              // seconds
    lastChecked: string | null         // ISO8601
  }

  activityLog: Array<{
    type: string
    agentId: string
    agentName: string
    message: string
    timestamp: string                  // ISO8601
  }>                                   // Last 100 entries
}
```

---

## Testing the API

```bash
# Health check
curl http://localhost:3001/api/health

# Full state (pretty printed)
curl http://localhost:3001/api/state | python3 -m json.tool

# Agent statuses only
curl http://localhost:3001/api/agents | python3 -m json.tool

# WebSocket test (requires wscat)
npm install -g wscat
wscat -c ws://localhost:3001/ws
```
