# Architecture

## Overview

OpenClaw Mission Control has three layers:

1. **Bridge** — Node.js process on your Pi that reads OpenClaw session files and broadcasts state
2. **Tunnel** — Cloudflare Tunnel that securely exposes the bridge to the internet
3. **Frontend** — React app on Vercel that connects via WebSocket and renders the dashboard

---

## Full Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                   OpenClaw Agent Sessions                    │
│   ~/.openclaw/agents/main/sessions/session-*.jsonl           │
│   (newline-delimited JSON, one event per line)               │
└──────────────────────┬───────────────────────────────────────┘
                       │ File changes (chokidar)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Watcher (watcher.js)                                        │
│  - Monitors *.jsonl files with chokidar                      │
│  - Tracks read position per file to avoid re-parsing         │
│  - On startup: loads last 200 lines of latest session        │
│  - Every 10s: marks agents idle if no activity >60s          │
└──────────────────────┬───────────────────────────────────────┘
                       │ Raw JSONL line
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Parser (parser.js)                                          │
│  - Routes events by type and message role                    │
│  - Classifies tool names into stations (YouTube, Web, etc.)  │
│  - Produces typed events: session_start, tool_calls, etc.    │
└──────────────────────┬───────────────────────────────────────┘
                       │ Structured event object
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  State (state.js)                                            │
│  - Updates agent status, tool history, budget, activity log  │
│  - Notifies all connected WebSocket clients                  │
└──────────┬───────────────────────┬───────────────────────────┘
           │                       │
           │ REST (pull)           │ WebSocket (push)
           ▼                       ▼
┌──────────────────┐   ┌──────────────────────────────────────┐
│  Express REST    │   │  WebSocket Server (/ws)              │
│  /api/state      │   │  - Sends snapshot on connect         │
│  /api/health     │   │  - Broadcasts state on every update  │
│  /api/agents     │   └──────────────┬───────────────────────┘
│  /api/budget     │                  │
│  /api/tools      │                  │ wss://
│  /api/activity   │        Cloudflare Tunnel
└──────────────────┘                  │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │  React Frontend (Vercel)                     │
               │  useBridge.js — WebSocket hook               │
               │  - Receives snapshot on connect              │
               │  - Updates React state on each message       │
               │  - Auto-reconnects with exponential backoff  │
               └──────────┬───────────────────────────────────┘
                          │
               ┌──────────┴──────────┐
               ▼                     ▼
        ┌─────────────┐      ┌──────────────┐
        │  Card View  │      │  Pixel View  │
        │  (panels)   │      │  (canvas)    │
        └─────────────┘      └──────────────┘
```

---

## State Shape

The full state object that flows through the system:

```json
{
  "agents": {
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
      "taskPreview": "Research the latest earnings reports for..."
    }
  },

  "tools": {
    "recent": [
      {
        "agentId": "main",
        "name": "web_search",
        "station": { "name": "Web Search", "icon": "🌐" },
        "isError": false,
        "duration": 1240,
        "timestamp": "2024-03-15T12:30:44.000Z"
      }
    ],
    "counts": { "web_search": 14, "read_file": 3 },
    "stationCounts": { "Web Search": 14, "File System": 3 },
    "activeTools": {
      "call_abc123": {
        "agentId": "main",
        "name": "web_search",
        "station": { "name": "Web Search", "icon": "🌐" },
        "startTime": "2024-03-15T12:30:45.000Z",
        "arguments": { "query": "AAPL earnings Q1 2024" }
      }
    }
  },

  "budget": {
    "anthropic": {
      "provider": "anthropic",
      "tokensUsed": 142500,
      "costUsd": 4.28,
      "limits": { "monthlyUsd": 100, "monthlyTokens": 5000000 },
      "callCount": 38,
      "lastUsed": "2024-03-15T12:30:45.123Z"
    }
  },

  "gateway": {
    "status": "running",
    "pid": 12345,
    "port": 8080,
    "version": "1.2.3",
    "telegram": { "connected": true, "bot": "@my_bot" },
    "uptime": 3600,
    "lastChecked": "2024-03-15T12:30:40.000Z"
  },

  "activityLog": [
    {
      "type": "tool_calls",
      "agentId": "main",
      "agentName": "Main Agent",
      "message": "Using Web Search",
      "timestamp": "2024-03-15T12:30:45.123Z"
    }
  ]
}
```

---

## WebSocket Message Types

### Bridge → Frontend

| Type | When | Description |
|---|---|---|
| `snapshot` | On connect | Full state object |
| `state` | On every update | Full state object (same shape) |

```json
{ "type": "snapshot", "data": { ...full state... } }
{ "type": "state",    "data": { ...full state... } }
```

Both message types carry the complete state. The frontend always replaces its state entirely (no partial merging).

---

## Event Types (Parser Output)

| Event | Trigger | Key Fields |
|---|---|---|
| `session_start` | New session file / session record | agentId, sessionId, version |
| `model_change` | Model switched | agentId, provider, model |
| `thinking_change` | Thinking level changed | agentId, level |
| `tool_calls` | Agent invokes tool(s) | agentId, tools[], usage, provider |
| `tool_result` | Tool returns result | agentId, callId, toolName, isError, station |
| `agent_thinking` | Assistant text response | agentId, usage, preview |
| `usage_update` | Usage-only assistant message | agentId, usage, provider |
| `user_prompt` | User sends prompt | agentId, preview |

---

## Agent Status Lifecycle

```
           ┌──────────┐
           │ offline  │  (bridge just started, no session seen)
           └────┬─────┘
                │ session_start
                ▼
           ┌──────────┐
           │  idle    │  (session active, no recent activity)
           └────┬─────┘
                │ user_prompt / agent_thinking
                ▼
           ┌──────────┐
           │ working  │  (agent generating response)
           └────┬─────┘
                │ tool_calls
                ▼
           ┌──────────┐
           │ tool_use │  (tool call in progress)
           └────┬─────┘
                │ tool_result (all tools done)
                ▼
           ┌──────────┐
           │ working  │  (back to generating)
           └────┬─────┘
                │ 60s no activity
                ▼
           ┌──────────┐
           │  idle    │
           └──────────┘
```

Error state is set when a `tool_result` has `isError: true`.

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Bridge server | Node.js + Express | Lightweight, native WebSocket support |
| File watching | chokidar | Cross-platform, handles JSONL append well |
| WebSocket | ws | Fast, minimal WS library |
| Tunnel | Cloudflare Tunnel | Zero config, no port forwarding needed |
| Frontend | React 18 + Vite | Fast HMR, simple component model |
| Pixel canvas | HTML5 Canvas | Full control over rendering |
| Hosting | Vercel | Free, instant deploys, global CDN |
