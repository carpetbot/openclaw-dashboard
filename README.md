# OpenClaw Mission Control

A real-time visual operations dashboard for OpenClaw multi-agent AI systems. Monitor agent activity, tool usage, API budget, and gateway health — all from a single web UI deployed on Vercel, connected back to your local Orange Pi via a secure Cloudflare tunnel.

![Dashboard](docs/assets/dashboard-preview.png)

---

## What It Does

- **Live agent status** — see which agents are idle, working, or using tools right now
- **Tool tracking** — watch tool calls happen in real time with station breakdowns
- **Budget monitoring** — per-provider token and cost tracking with monthly limits
- **Gateway health** — OpenClaw gateway status, PID, port, Telegram bot connection
- **Activity feed** — scrolling log of all agent events
- **Two view modes** — card view (panels) and pixel art retro office scene

---

## Architecture

```
┌─────────────────────────────────────────┐
│         Vercel (Frontend)               │
│   React dashboard @ your-app.vercel.app │
└─────────────┬───────────────────────────┘
              │ WebSocket (wss://)
              ▼
┌─────────────────────────────────────────┐
│      Cloudflare Tunnel                  │
│   your-tunnel-url → localhost:3001      │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      Orange Pi (Bridge)                 │
│   Watches JSONL → Serves state via WS   │
│   Polls gateway health every 10s        │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      OpenClaw Agent Sessions            │
│   ~/.openclaw/agents/*/sessions/*.jsonl │
└─────────────────────────────────────────┘
```

---

## Quick Start

See the full setup guide: **[docs/SETUP.md](docs/SETUP.md)**

```bash
# 1. Start the bridge on your Pi
cd bridge && npm install && npm start

# 2. Expose it via Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3001

# 3. Deploy the frontend to Vercel
cd frontend
VITE_BRIDGE_URL=wss://your-tunnel-url/ws npm run build
npx vercel --prod
```

---

## Documentation

| Guide | Description |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Step-by-step installation and deployment |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full technical architecture and data flow |
| [docs/BRIDGE.md](docs/BRIDGE.md) | Bridge layer deep-dive (watcher, parser, state, gateway) |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Frontend layer deep-dive (components, hooks, pixel view) |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | All configuration options explained |
| [docs/API.md](docs/API.md) | REST API and WebSocket message reference |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and fixes |

---

## Project Structure

```
openclaw-dashboard/
├── bridge/                  # Node.js backend (runs on your Pi)
│   ├── index.js             # Express + WebSocket server
│   ├── config.js            # Agent list, tools, budget limits
│   ├── state.js             # In-memory state store
│   ├── watcher.js           # JSONL file watcher (chokidar)
│   ├── parser.js            # Event parser
│   ├── gateway.js           # Gateway health poller
│   └── package.json
│
├── frontend/                # React app (deploys to Vercel)
│   ├── src/
│   │   ├── App.jsx          # Main dashboard component
│   │   ├── useBridge.js     # WebSocket hook
│   │   └── PixelScene.jsx   # Retro pixel art canvas view
│   ├── vite.config.js
│   ├── vercel.json
│   └── package.json
│
└── docs/                    # This documentation
```

---

## Roadmap

- [x] Phase 1: Bridge + Dashboard
- [ ] Phase 2: Pixel art character layer (The Sims style)
- [ ] Phase 3: Multi-agent orchestration view
- [ ] Phase 4: Budget alerting (Telegram notifications)
- [ ] Phase 5: Historical analytics (daily/weekly trends)
