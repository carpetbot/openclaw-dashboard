# Setup Guide

This guide walks through deploying the full OpenClaw Mission Control stack from scratch.

---

## Prerequisites

- Orange Pi (or any Linux machine) running 24/7
- Node.js 18+ installed on the Pi
- A [Cloudflare](https://cloudflare.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works)
- OpenClaw installed and generating session files at `~/.openclaw/`

---

## Step 1: Set Up the Bridge (on your Pi)

The bridge is a Node.js server that reads OpenClaw session files and streams state to the frontend via WebSocket.

```bash
# Navigate to the bridge folder
cd bridge

# Install dependencies
npm install

# (Optional) Edit config to match your agents and budget limits
nano config.js

# Start the bridge
npm start
```

You should see:

```
  ╔══════════════════════════════════════════╗
  ║       OpenClaw Dashboard Bridge          ║
  ╚══════════════════════════════════════════╝

  REST API:    http://localhost:3001/api/state
  WebSocket:   ws://localhost:3001/ws
  Health:      http://localhost:3001/api/health

  Watching 1 agent(s):
    → Main Agent (main)
```

**Verify it's working:**
```bash
curl http://localhost:3001/api/health
# { "bridge": "running", "agents": 1, "gateway": "unknown", "uptime": 12.3 }
```

---

## Step 2: Set Up Cloudflare Tunnel

The Cloudflare tunnel creates a secure public HTTPS/WSS URL that the Vercel frontend can reach. No port forwarding or firewall rules needed.

### Install cloudflared

```bash
# ARM64 (Orange Pi, Raspberry Pi 4)
curl -L -o cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb

# Verify
cloudflared --version
```

### Option A: Quick temporary tunnel (no domain required)

```bash
cloudflared tunnel --url http://localhost:3001
```

This gives you a temporary URL like `https://abc123.trycloudflare.com`. It changes every time you restart, so you'll need to update Vercel env vars each time.

### Option B: Permanent named tunnel (recommended)

```bash
# One-time login
cloudflared tunnel login

# Create a named tunnel
cloudflared tunnel create openclaw-bridge

# Run the tunnel
cloudflared tunnel --url http://localhost:3001 --name openclaw-bridge
```

Note down your tunnel URL — you'll need it in Step 3.

---

## Step 3: Deploy the Frontend to Vercel

```bash
cd frontend

# Install dependencies
npm install

# Set your bridge URL (use wss:// for secure WebSocket)
export VITE_BRIDGE_URL=wss://your-tunnel-url/ws
export VITE_BRIDGE_HTTP=https://your-tunnel-url

# Build
npm run build

# Deploy
npx vercel --prod
```

Or connect this repo to Vercel via the web UI and set environment variables in **Project Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `VITE_BRIDGE_URL` | `wss://your-tunnel-url/ws` |
| `VITE_BRIDGE_HTTP` | `https://your-tunnel-url` |

---

## Step 4: Run as a Systemd Service (recommended)

Set the bridge up as a system service so it starts automatically on reboot.

```bash
sudo tee /etc/systemd/system/openclaw-bridge.service << 'EOF'
[Unit]
Description=OpenClaw Dashboard Bridge
After=network.target

[Service]
Type=simple
User=orangepi
WorkingDirectory=/home/orangepi/openclaw-dashboard/openclaw-dashboard/bridge
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
Environment=BRIDGE_PORT=3001

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable openclaw-bridge
sudo systemctl start openclaw-bridge

# Check it's running
sudo systemctl status openclaw-bridge
```

---

## Reconnecting After a Restart

If the bridge stops (e.g. Pi rebooted), the dashboard will show **DISCONNECTED** and automatically retry the WebSocket connection with exponential backoff (up to 30s between attempts).

To restart manually:
```bash
# If using systemd service
sudo systemctl restart openclaw-bridge

# If running manually
cd bridge && npm start

# Don't forget the Cloudflare tunnel
cloudflared tunnel --url http://localhost:3001
```

If you used a temporary tunnel, the URL will have changed — update the Vercel env vars and redeploy.

---

## Development Mode

To run the frontend locally against your Pi's bridge:

```bash
cd frontend
VITE_BRIDGE_URL=ws://your-pi-ip:3001/ws npm run dev
```

Open `http://localhost:5173`.

To hot-reload the bridge during development:
```bash
cd bridge
npm run dev   # uses node --watch
```
