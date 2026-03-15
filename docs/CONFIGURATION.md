# Configuration Reference

All bridge configuration lives in `bridge/config.js`. Edit this file to match your setup before starting the bridge.

---

## openclawHome

```js
openclawHome: process.env.OPENCLAW_HOME || '~/.openclaw'
```

Path to your OpenClaw data directory. The bridge expects this structure:

```
~/.openclaw/
  agents/
    {dir}/
      sessions/
        session-YYYYMMDD-HHmmss.jsonl
```

Override with the `OPENCLAW_HOME` environment variable if your data lives elsewhere.

---

## agents

```js
agents: [
  { id: 'main', name: 'Main Agent', dir: 'main' },
]
```

List of agents to monitor. Each entry:

| Field | Description |
|---|---|
| `id` | Unique identifier used internally |
| `name` | Display name shown in the dashboard |
| `dir` | Subdirectory name under `~/.openclaw/agents/` |

**Adding more agents:**
```js
agents: [
  { id: 'main',             name: 'Main Agent',       dir: 'main' },
  { id: 'signal-feed',      name: 'SignalFeed',        dir: 'signal-feed' },
  { id: 'market-structure', name: 'MarketStructure',   dir: 'market-structure' },
  { id: 'chief-analyst',    name: 'ChiefAnalyst',      dir: 'chief-analyst' },
],
```

---

## featuredTools

```js
featuredTools: [
  { pattern: /youtube|yt_scraper|yt-scraper/i, name: 'YouTube Scraper', icon: '📺' },
  { pattern: /perplexity|web_search|sonar/i,   name: 'Web Search',      icon: '🌐' },
  { pattern: /google_sheets|gsheet/i,           name: 'Google Sheets',   icon: '📊' },
  { pattern: /telegram|tg_send|tg_post/i,       name: 'Telegram',        icon: '✈️' },
  { pattern: /read|write|file/i,                name: 'File System',     icon: '📁' },
],
```

Tool names are matched against these patterns when a `tool_calls` event is parsed. The first match wins. Unmatched tools fall into the generic station (`{ name: 'Tools', icon: '🔧' }`).

Each entry:

| Field | Description |
|---|---|
| `pattern` | RegExp matched against the tool function name |
| `name` | Station label shown in dashboard and pixel view |
| `icon` | Emoji displayed next to the station name |

**Adding a custom tool:**
```js
{ pattern: /my_custom_tool|another_tool/i, name: 'My Tool', icon: '⭐' },
```

---

## port

```js
port: parseInt(process.env.BRIDGE_PORT || '3001')
```

TCP port the bridge listens on. Override with `BRIDGE_PORT` env var.

---

## gatewayPollInterval

```js
gatewayPollInterval: 10_000  // milliseconds
```

How often the bridge runs `openclaw gateway status` to check health. Default: every 10 seconds.

---

## idleThreshold

```js
idleThreshold: 60_000  // milliseconds
```

How long an agent can go without activity before being marked `idle`. Default: 60 seconds.

---

## budgetLimits

```js
budgetLimits: {
  'kimi-coding':  { monthlyUsd: 50,  monthlyTokens: 10_000_000 },
  'openrouter':   { monthlyUsd: 100, monthlyTokens: 5_000_000 },
  'minimax':      { monthlyUsd: 30,  monthlyTokens: 8_000_000 },
  'anthropic':    { monthlyUsd: 100, monthlyTokens: 5_000_000 },
},
```

Monthly limits per provider, used to calculate the percentage on budget progress bars. The key must match the `provider` field in OpenClaw session events exactly.

If a provider has no entry here, the budget bar shows raw usage without a percentage.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENCLAW_HOME` | `~/.openclaw` | Path to OpenClaw data directory |
| `BRIDGE_PORT` | `3001` | Port to listen on |

Set these in the systemd service file or your shell profile if needed.

---

## Frontend Environment Variables

Set in Vercel project settings or in `frontend/.env.local` for local dev:

| Variable | Default | Description |
|---|---|---|
| `VITE_BRIDGE_URL` | `ws://localhost:3001/ws` | WebSocket URL |
| `VITE_BRIDGE_HTTP` | `http://localhost:3001` | REST base URL |

Use `wss://` and `https://` when connecting through Cloudflare Tunnel.
