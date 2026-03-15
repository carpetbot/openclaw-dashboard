# Frontend Layer

The frontend is a React app built with Vite, deployed to Vercel. It connects to the bridge via WebSocket and renders two view modes: a card-based dashboard and a retro pixel art scene.

---

## Files

```
frontend/src/
├── App.jsx          Main dashboard, layout, all panels
├── useBridge.js     Custom WebSocket hook
└── PixelScene.jsx   HTML5 Canvas pixel art scene
```

---

## App.jsx — Main Component

Root component that owns all dashboard state and renders everything.

**State:**
```js
const { state, connected, reconnecting } = useBridge();
const [viewMode, setViewMode] = useState('card');  // 'card' | 'pixel'
const [now, setNow] = useState(Date.now());         // ticks every 1s
```

`now` is updated via `setInterval` every second so relative timestamps ("3s ago", "2m ago") stay current without any state updates from the bridge.

---

### Card View Layout

```
┌──────────────────────────────────────────────────────────┐
│  ⚔️ OpenClaw Mission Control    [PIXEL MODE]    🟢 LIVE  │
├───────────────────┬───────────────┬──────────────────────┤
│  Agent Panel      │  Activity     │  Budget Panel        │
│  ─────────────    │  Feed         │  ──────────────      │
│  • Main Agent     │               │  anthropic ██░░ 14%  │
│    working        │  🔧 Main used │  openrouter ░░░░ 2%  │
│    Web Search     │  web_search   │                      │
│    "Research..."  │  2s ago       │  Tool Stats          │
│                   │               │  ──────────────      │
│  Gateway Panel    │  💬 Main got  │  Web Search   14     │
│  ─────────────    │  new prompt   │  File System   3     │
│  🟢 running       │  3m ago       │  YouTube       1     │
│  pid 12345        │               │                      │
│  port 8080        │               │  Recent calls:       │
│  @my_bot ✓        │               │  web_search 1.2s     │
└───────────────────┴───────────────┴──────────────────────┘
```

**Panels:**

### ConnectionBadge
Visual indicator in the header.
- 🟢 **LIVE** — connected, glowing green pulse
- 🟡 **RECONNECTING** — amber, attempting to reconnect
- 🔴 **DISCONNECTED** — red, all reconnect attempts failed

### AgentPanel
One card per agent defined in config.

Status colors:
| Status | Color | Meaning |
|---|---|---|
| `working` | Green `#00ff88` | Generating a response |
| `tool_use` | Amber `#ffaa00` | Tool call in progress |
| `idle` | Gray | Waiting for input |
| `error` | Red `#ff4444` | Last tool call errored |
| `offline` | Dim gray | No session seen yet |

Each card shows:
- Status dot + label
- Current tool name and station icon (if tool_use)
- Provider / model tag
- Time since last activity
- Task preview (first 120 chars of last prompt)

### GatewayPanel
Shows the health of the OpenClaw gateway process:
- Status (running / stopped / unknown)
- Version string
- PID and port
- Telegram bot name and connection status
- Last health check timestamp

### ActivityFeed
Scrolling log of the last 40 events (12 in compact mode).

Event icons:
| Icon | Event type |
|---|---|
| 🚀 | session_start |
| 💬 | user_prompt |
| 🔧 | tool_calls / tool_result |
| ❌ | tool error |
| 🤖 | agent_thinking |
| ⚡ | model_change |

Older events fade to lower opacity — most recent are brightest.

### BudgetPanel
Per-provider token and cost tracking.

Progress bar color:
| Usage % | Color |
|---|---|
| < 60% | Green |
| 60–85% | Amber |
| > 85% | Red (glowing) |

Shows: provider name, tokens used / limit, cost in USD, call count.

### ToolStats
Two sections:
1. **Station counts** — card per station (YouTube, Web Search, etc.) with total call count
2. **Recent tool calls** — last 8 calls with name, duration (ms), error status

---

## Pixel View

An alternative view that renders all agent activity as a retro pixel art office scene on an HTML5 Canvas.

Toggle with the **[PIXEL MODE]** button in the header.

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  [YT]    [WEB]    [SHEETS]  [TELE]  [FILES]  [TOOLS]  │
│                                                        │
│                 🧑 Main Agent                          │
│              "web_search: ..."                         │
│                    →→→→→                               │
│                                                        │
├──────────────────┬─────────────────────────────────────┤
│ Agent Status     │ Activity Feed (compact)             │
│ • Main  working  │ 🔧 Main used web_search  2s ago     │
└──────────────────┴─────────────────────────────────────┘
│ 🟢 gateway  anthropic ██░░ 14%  openrouter ░░░░  2%  12:30:45 │
└────────────────────────────────────────────────────────────────┘
```

### Canvas Details
- **Game resolution:** 480×280 pixels
- **Display scale:** 3× (renders at 1440×840 CSS pixels)
- **Floor line:** y = 188
- **HUD strip:** y = 258–280

### Stations
Six stations are rendered across the back wall, one per featured tool category plus generic. Each station has:
- A desk with shadow
- A monitor (glows and animates a scanline when an agent is using it)
- A glyph symbol (▶ YouTube, ◉ Web, ⊞ Sheets, ✈ Telegram, ▬ Files, ◆ Generic)
- A label

### Agent Sprites
Each agent is rendered as an 8×16 pixel character:
- **Head** with hair
- **Torso** with shirt (color varies by agent index)
- **Legs** with 4-frame walking animation
- **Name tag** floating above
- **Speech bubble** showing current tool or task

Agents walk smoothly to whichever station corresponds to their current tool. When idle, they stand at a default position.

### HUD Strip
Bottom bar with:
- Gateway status dot (green/red)
- Budget bars (up to 4 providers), colored by usage %
- Live clock (HH:MM:SS)

### Animation Loop
Uses `requestAnimationFrame`:
1. Clear background
2. Draw sky, wall grid, checkerboard floor
3. Draw all stations
4. Sort agents back-to-front by x position (painter's algorithm)
5. Draw each agent (body, name tag, speech bubble)
6. Draw HUD
7. Apply scanline overlay (35% opacity)
8. Schedule next frame

---

## useBridge.js — WebSocket Hook

Custom React hook that manages the entire WebSocket lifecycle.

```js
const { state, connected, reconnecting } = useBridge();
```

**Connection flow:**
1. Reads `VITE_BRIDGE_URL` env var (default: `ws://localhost:3001/ws`)
2. Opens WebSocket connection
3. On `message`: parses JSON, sets React state
4. On `close`/`error`: sets `reconnecting=true`, schedules reconnect

**Reconnection backoff:**
- Starts at 3 seconds
- Multiplies by 1.5× on each failure
- Caps at 30 seconds
- Resets to 3s on successful reconnect

**Message handling:**
Both `snapshot` and `state` message types are handled identically — the full state is set as React state, triggering a full re-render.

**Cleanup:**
- `useEffect` cleanup closes the socket and clears reconnect timers on component unmount

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_BRIDGE_URL` | `ws://localhost:3001/ws` | WebSocket URL to bridge |
| `VITE_BRIDGE_HTTP` | `http://localhost:3001` | REST API base URL |

Set these in Vercel's project settings for production. For local dev, create a `.env.local` file in the `frontend/` folder:

```
VITE_BRIDGE_URL=ws://your-pi-ip:3001/ws
VITE_BRIDGE_HTTP=http://your-pi-ip:3001
```

---

## Build & Deploy

```bash
cd frontend
npm install
npm run build      # outputs to dist/
npx vercel --prod  # deploy dist/ to Vercel
```

`vercel.json` configures Vercel to use Vite's build output from `dist/`.
