# Troubleshooting

---

## Dashboard shows DISCONNECTED

**Cause:** The bridge is not running, or the Cloudflare Tunnel is down.

**Fix:**
```bash
# 1. Check if bridge is running
curl http://localhost:3001/api/health

# 2. If not, start it
cd ~/openclaw-dashboard/openclaw-dashboard/bridge
npm start

# 3. Check Cloudflare Tunnel
pgrep -a cloudflared

# 4. If not running, restart it
cloudflared tunnel --url http://localhost:3001
```

If using a temporary tunnel, the URL will have changed. Update `VITE_BRIDGE_URL` in Vercel and redeploy.

---

## Dashboard shows RECONNECTING indefinitely

**Cause:** Frontend can reach the tunnel but the bridge WebSocket isn't responding.

**Fix:**
```bash
# Test the WebSocket directly
npm install -g wscat
wscat -c ws://localhost:3001/ws

# Check bridge logs for errors
# If using systemd:
sudo journalctl -u openclaw-bridge -f
```

Make sure the bridge is listening on `0.0.0.0` not just `127.0.0.1` (it does by default in `index.js`).

---

## All agents show "offline"

**Cause:** The bridge started but can't find session files.

**Check:**
```bash
# Verify session files exist
ls ~/.openclaw/agents/main/sessions/

# Check what the bridge is watching
curl http://localhost:3001/api/agents
```

**Fix:**
- Ensure `config.js` agent `dir` values match the actual directory names under `~/.openclaw/agents/`
- Ensure OpenClaw has been run at least once to create session files
- Check the `openclawHome` path in config is correct

---

## No token usage showing

**Cause:** Some providers (like Kimi free tier) report `cost: 0` or omit usage fields.

The bridge still tracks tokens if they're present in the session events. Check with:
```bash
curl http://localhost:3001/api/budget
```

If `tokensUsed` is 0 for all providers, the session files may not include usage data. This is a provider-level limitation.

---

## Gateway status shows "unknown"

**Cause:** The `openclaw` CLI is not in the PATH of the user running the bridge.

**Fix:**
```bash
# Find openclaw
which openclaw

# Test the command the bridge runs
openclaw gateway status

# If it works manually but not in service, add PATH to systemd:
# In /etc/systemd/system/openclaw-bridge.service:
[Service]
Environment=PATH=/usr/local/bin:/usr/bin:/bin:/home/orangepi/.local/bin
```

---

## Budget bars show no percentage

**Cause:** The provider name in session events doesn't match the key in `config.budgetLimits`.

**Fix:**
```bash
# Check what provider names appear in the data
curl http://localhost:3001/api/budget
```

The keys must match exactly (case-sensitive). Update `budgetLimits` in `config.js`:
```js
budgetLimits: {
  'exact-provider-name': { monthlyUsd: 100, monthlyTokens: 5_000_000 },
}
```

---

## Bridge crashes on startup

**Cause:** Missing `node_modules`, wrong Node.js version, or syntax error in config.

**Fix:**
```bash
cd bridge
node --version    # needs 18+
npm install       # reinstall dependencies
node index.js     # run directly to see error
```

---

## WebSocket connects but state is empty / stale

**Cause:** The bridge loaded initial state from an old session, and no new events have come in.

**Fix:**
```bash
# Restart the bridge — it will reload from latest session
sudo systemctl restart openclaw-bridge
# or
cd bridge && npm start
```

The bridge loads the last 200 lines of the most recent session file on startup. If you need older history, this is by design — the dashboard shows live state, not historical data.

---

## Pixel view agents don't move

**Cause:** No `currentTool` in agent state — agents only walk to stations when actively using a tool.

An idle or working (generating) agent will stand in place. This is correct behavior. Agents animate to their tool's station only during `tool_use` status.

---

## Vercel deployment fails

**Check:**
- `VITE_BRIDGE_URL` is set in Vercel environment variables
- The URL uses `wss://` (not `ws://`) for production
- The Cloudflare Tunnel URL is active at deploy time (the URL is baked into the build)

If your tunnel URL changes, you need to update the Vercel env var and trigger a redeploy:
```bash
cd frontend
npm run build
npx vercel --prod
```

---

## High CPU usage on the Pi

**Cause:** Chokidar polling on a filesystem that doesn't support inotify events.

**Fix:** Add `usePolling: false` check or ensure inotify is available:
```bash
cat /proc/sys/fs/inotify/max_user_watches
# If low, increase it:
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## Getting more debug output

The bridge logs WebSocket connect/disconnect and file watch events to stdout. To capture these when running as a service:
```bash
sudo journalctl -u openclaw-bridge -f --output=cat
```

To add more verbose logging temporarily, you can run the bridge directly:
```bash
cd bridge && node index.js 2>&1 | tee bridge.log
```
