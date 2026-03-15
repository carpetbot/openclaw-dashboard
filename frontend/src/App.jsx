// App.jsx — OpenClaw Mission Control Dashboard
import React, { useState, useEffect, useMemo } from 'react';
import { useBridge } from './hooks/useBridge';
import { PixelScene } from './components/PixelScene';

// ---- Configuration ----
const BRIDGE_WS = import.meta.env.VITE_BRIDGE_URL || 'ws://localhost:3001/ws';

// ---- Status config ----
const STATUS_CONFIG = {
  working:  { label: 'WORKING',  color: '#00ff88', bg: '#00ff8818', pulse: true },
  tool_use: { label: 'TOOL USE', color: '#ffaa00', bg: '#ffaa0018', pulse: true },
  idle:     { label: 'IDLE',     color: '#666',    bg: '#66666618', pulse: false },
  error:    { label: 'ERROR',    color: '#ff4444', bg: '#ff444418', pulse: true },
  offline:  { label: 'OFFLINE',  color: '#333',    bg: '#33333318', pulse: false },
};

// ---- Main App ----
export default function App() {
  const { state, connected, reconnecting } = useBridge(BRIDGE_WS);
  const [now, setNow] = useState(Date.now());
  const [viewMode, setViewMode] = useState('pixel'); // 'card' | 'pixel'

  // Tick every second for relative timestamps
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={styles.root}>
      <style>{globalCSS}</style>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>⚔️</div>
          <div>
            <h1 style={styles.title}>OPENCLAW MISSION CONTROL</h1>
            <p style={styles.subtitle}>
              {state?.gateway?.version || 'Connecting...'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setViewMode(v => v === 'card' ? 'pixel' : 'card')}
            style={styles.viewToggle}
          >
            {viewMode === 'card' ? '🕹️ PIXEL' : '📋 CARDS'}
          </button>
          <ConnectionBadge connected={connected} reconnecting={reconnecting} />
        </div>
      </header>

      {/* Main Content */}
      {!state ? (
        <LoadingState reconnecting={reconnecting} />
      ) : viewMode === 'pixel' ? (
        <div style={styles.pixelLayout}>
          <PixelScene state={state} />
          <div style={styles.pixelStrip}>
            <AgentPanel agents={state.agents} now={now} compact />
            <div style={{ flex: 1 }}>
              <ActivityFeed log={state.activityLog} now={now} compact />
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {/* Left Column */}
          <div style={styles.leftCol}>
            <AgentPanel agents={state.agents} now={now} />
            <GatewayPanel gateway={state.gateway} />
          </div>

          {/* Center Column */}
          <div style={styles.centerCol}>
            <ActivityFeed log={state.activityLog} now={now} />
          </div>

          {/* Right Column */}
          <div style={styles.rightCol}>
            <BudgetPanel budget={state.budget} />
            <ToolStats tools={state.tools} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Connection Badge ----
function ConnectionBadge({ connected, reconnecting }) {
  const dotColor = connected ? '#00ff88' : reconnecting ? '#ffaa00' : '#ff4444';
  const label = connected ? 'LIVE' : reconnecting ? 'RECONNECTING' : 'DISCONNECTED';
  return (
    <div style={styles.badge}>
      <div style={{
        ...styles.dot,
        backgroundColor: dotColor,
        boxShadow: connected ? `0 0 8px ${dotColor}` : 'none',
      }} />
      <span style={{ ...styles.badgeText, color: dotColor }}>{label}</span>
    </div>
  );
}

// ---- Loading State ----
function LoadingState({ reconnecting }) {
  return (
    <div style={styles.loading}>
      <div style={styles.loadingIcon}>⚔️</div>
      <p style={styles.loadingText}>
        {reconnecting ? 'Reconnecting to bridge...' : 'Connecting to OpenClaw Bridge...'}
      </p>
      <p style={styles.loadingHint}>
        Make sure the bridge is running on your Pi: <code style={styles.code}>cd bridge && npm start</code>
      </p>
    </div>
  );
}

// ---- Agent Panel ----
function AgentPanel({ agents, now, compact }) {
  const agentList = Object.values(agents);

  if (compact) {
    return (
      <div style={styles.compactAgents}>
        {agentList.map(agent => {
          const cfg = STATUS_CONFIG[agent.status] || STATUS_CONFIG.offline;
          return (
            <div key={agent.id} style={{ ...styles.compactAgent, borderColor: cfg.color }}>
              <div style={{ ...styles.statusPill, color: cfg.color, backgroundColor: cfg.bg, marginBottom: '4px' }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: '11px', color: '#ccc', fontWeight: 600 }}>{agent.name}</div>
              {agent.currentTool && (
                <div style={{ fontSize: '10px', color: cfg.color, marginTop: '2px' }}>
                  {agent.currentTool.name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelIcon}>🤖</span>
        <span style={styles.panelTitle}>AGENTS</span>
        <span style={styles.panelCount}>
          {agentList.filter(a => a.status === 'working' || a.status === 'tool_use').length}/
          {agentList.length} active
        </span>
      </div>

      {agentList.map(agent => {
        const cfg = STATUS_CONFIG[agent.status] || STATUS_CONFIG.offline;
        const timeAgo = agent.lastActive ? relativeTime(agent.lastActive, now) : 'never';

        return (
          <div key={agent.id} style={{ ...styles.agentCard, borderLeftColor: cfg.color }}>
            <div style={styles.agentTop}>
              <div style={styles.agentName}>{agent.name}</div>
              <div style={{
                ...styles.statusPill,
                color: cfg.color,
                backgroundColor: cfg.bg,
                animation: cfg.pulse ? 'pulse 2s ease-in-out infinite' : 'none',
              }}>
                {cfg.label}
              </div>
            </div>

            {agent.currentTool && (
              <div style={styles.agentTool}>
                {agent.currentTool.station?.icon || '🔧'} {agent.currentTool.name}
              </div>
            )}

            <div style={styles.agentMeta}>
              {agent.currentProvider && (
                <span style={styles.metaTag}>{agent.currentProvider}/{agent.currentModel}</span>
              )}
              <span style={styles.metaTime}>{timeAgo}</span>
            </div>

            {agent.taskPreview && (
              <div style={styles.taskPreview}>{agent.taskPreview}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Gateway Panel ----
function GatewayPanel({ gateway }) {
  const isRunning = gateway.status === 'running';
  const color = isRunning ? '#00ff88' : '#ff4444';

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelIcon}>🏗️</span>
        <span style={styles.panelTitle}>GATEWAY</span>
      </div>

      <div style={{ ...styles.gatewayStatus, borderColor: color }}>
        <div style={{ ...styles.gatewayDot, backgroundColor: color }} />
        <span style={{ color }}>{gateway.status?.toUpperCase() || 'UNKNOWN'}</span>
      </div>

      <div style={styles.gatewayGrid}>
        <GatewayItem label="VERSION" value={gateway.version || '—'} />
        <GatewayItem label="PID" value={gateway.pid || '—'} />
        <GatewayItem label="PORT" value={gateway.port || '—'} />
        <GatewayItem label="TELEGRAM"
          value={gateway.telegram?.connected
            ? (gateway.telegram.bot || 'Connected')
            : 'Disconnected'}
          color={gateway.telegram?.connected ? '#00ff88' : '#ff4444'}
        />
      </div>

      {gateway.lastChecked && (
        <div style={styles.lastChecked}>
          Last checked: {new Date(gateway.lastChecked).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function GatewayItem({ label, value, color }) {
  return (
    <div style={styles.gwItem}>
      <div style={styles.gwLabel}>{label}</div>
      <div style={{ ...styles.gwValue, color: color || '#ccc' }}>{value}</div>
    </div>
  );
}

// ---- Activity Feed ----
function ActivityFeed({ log, now, compact }) {
  const typeIcons = {
    session: '🚀',
    prompt: '💬',
    tool: '🔧',
    error: '❌',
  };

  if (compact) {
    return (
      <div style={{ ...styles.panel, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={styles.panelHeader}>
          <span style={styles.panelIcon}>📡</span>
          <span style={styles.panelTitle}>ACTIVITY FEED</span>
        </div>
        <div style={{ ...styles.feedScroll, maxHeight: '120px' }}>
          {(!log || log.length === 0) ? (
            <div style={styles.emptyFeed}>Waiting for events...</div>
          ) : (
            log.slice(0, 12).map((entry, i) => (
              <div key={i} style={{ ...styles.feedItem, opacity: Math.max(0.3, 1 - (i * 0.06)) }}>
                <span style={styles.feedIcon}>{typeIcons[entry.type] || '•'}</span>
                <span style={styles.feedAgent}>{entry.agentName}</span>
                <span style={styles.feedMsg}>{entry.message}</span>
                <span style={styles.feedTime}>{relativeTime(entry.timestamp, now)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.panel, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <span style={styles.panelIcon}>📡</span>
        <span style={styles.panelTitle}>ACTIVITY FEED</span>
      </div>

      <div style={styles.feedScroll}>
        {(!log || log.length === 0) ? (
          <div style={styles.emptyFeed}>Waiting for events...</div>
        ) : (
          log.slice(0, 40).map((entry, i) => (
            <div key={i} style={{
              ...styles.feedItem,
              opacity: Math.max(0.3, 1 - (i * 0.015)),
            }}>
              <span style={styles.feedIcon}>{typeIcons[entry.type] || '•'}</span>
              <span style={styles.feedAgent}>{entry.agentName}</span>
              <span style={styles.feedMsg}>{entry.message}</span>
              <span style={styles.feedTime}>{relativeTime(entry.timestamp, now)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- Budget Panel ----
function BudgetPanel({ budget }) {
  const providers = Object.values(budget);

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelIcon}>💰</span>
        <span style={styles.panelTitle}>API BUDGET</span>
      </div>

      {providers.length === 0 ? (
        <div style={styles.emptyFeed}>No API usage tracked yet</div>
      ) : (
        providers.map(p => {
          const tokenPct = p.limits?.monthlyTokens
            ? Math.min(100, (p.tokensUsed / p.limits.monthlyTokens) * 100)
            : 0;
          const barColor = tokenPct > 85 ? '#ff4444' : tokenPct > 60 ? '#ffaa00' : '#00ff88';

          return (
            <div key={p.provider} style={styles.budgetRow}>
              <div style={styles.budgetHeader}>
                <span style={styles.budgetName}>{p.provider}</span>
                <span style={styles.budgetCost}>
                  ${p.costUsd.toFixed(2)}
                  {p.limits?.monthlyUsd ? ` / $${p.limits.monthlyUsd}` : ''}
                </span>
              </div>

              {/* Token bar */}
              <div style={styles.barTrack}>
                <div style={{
                  ...styles.barFill,
                  width: `${tokenPct}%`,
                  backgroundColor: barColor,
                  boxShadow: `0 0 8px ${barColor}40`,
                }} />
              </div>

              <div style={styles.budgetFooter}>
                <span>{formatTokens(p.tokensUsed)} tokens</span>
                <span>{p.callCount} calls</span>
                <span>{tokenPct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---- Tool Stats ----
function ToolStats({ tools }) {
  const stationEntries = Object.entries(tools.stationCounts || {})
    .sort((a, b) => b[1] - a[1]);

  const recentTools = tools.recent || [];

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelIcon}>🛠️</span>
        <span style={styles.panelTitle}>TOOL USAGE</span>
      </div>

      {/* Station breakdown */}
      {stationEntries.length > 0 && (
        <div style={styles.stationGrid}>
          {stationEntries.map(([name, count]) => (
            <div key={name} style={styles.stationCard}>
              <div style={styles.stationCount}>{count}</div>
              <div style={styles.stationName}>{name}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent tool calls */}
      <div style={styles.toolRecent}>
        <div style={styles.toolRecentHeader}>Recent Calls</div>
        {recentTools.slice(0, 8).map((t, i) => (
          <div key={i} style={{
            ...styles.toolRow,
            borderLeftColor: t.isError ? '#ff4444' : '#00ff8840',
          }}>
            <span style={styles.toolIcon}>{t.station?.icon || '🔧'}</span>
            <span style={styles.toolName}>{t.name}</span>
            {t.duration && (
              <span style={styles.toolDuration}>{(t.duration / 1000).toFixed(1)}s</span>
            )}
            {t.isError && <span style={styles.toolError}>ERR</span>}
          </div>
        ))}
        {recentTools.length === 0 && (
          <div style={styles.emptyFeed}>No tool calls yet</div>
        )}
      </div>
    </div>
  );
}

// ---- Utility Functions ----
function relativeTime(timestamp, now) {
  const diff = now - new Date(timestamp).getTime();
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ---- Global CSS ----
const globalCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #root { height: 100%; }

  body {
    background: #0a0a0f;
    color: #ccc;
    font-family: 'JetBrains Mono', monospace;
    -webkit-font-smoothing: antialiased;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

  code {
    background: #1a1a2e;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.85em;
    color: #00ff88;
  }
`;

// ---- Styles ----
const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '16px',
    maxWidth: '1440px',
    margin: '0 auto',
    position: 'relative',
  },

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #0d0d1a 0%, #141428 100%)',
    border: '1px solid #1a1a2e',
    borderRadius: '8px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    fontSize: '28px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '3px',
  },
  subtitle: {
    fontSize: '11px',
    color: '#666',
    marginTop: '2px',
  },

  // Connection badge
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    background: '#111',
    borderRadius: '20px',
    border: '1px solid #222',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  badgeText: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '2px',
  },

  // Grid layout
  grid: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr 320px',
    gap: '16px',
    flex: 1,
    minHeight: 0,
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  centerCol: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  // Panel (shared card style)
  panel: {
    background: 'linear-gradient(180deg, #0e0e1a 0%, #0a0a14 100%)',
    border: '1px solid #1a1a2e',
    borderRadius: '8px',
    padding: '16px',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '14px',
    paddingBottom: '10px',
    borderBottom: '1px solid #1a1a2e',
  },
  panelIcon: {
    fontSize: '14px',
  },
  panelTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#888',
    letterSpacing: '2px',
    flex: 1,
  },
  panelCount: {
    fontSize: '10px',
    color: '#555',
  },

  // Agent cards
  agentCard: {
    borderLeft: '3px solid #333',
    padding: '10px 12px',
    marginBottom: '8px',
    background: '#0c0c18',
    borderRadius: '0 6px 6px 0',
  },
  agentTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  agentName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#eee',
  },
  statusPill: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    padding: '3px 8px',
    borderRadius: '10px',
  },
  agentTool: {
    fontSize: '11px',
    color: '#ffaa00',
    marginBottom: '4px',
  },
  agentMeta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  metaTag: {
    fontSize: '10px',
    color: '#555',
    background: '#111',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  metaTime: {
    fontSize: '10px',
    color: '#444',
    marginLeft: 'auto',
  },
  taskPreview: {
    fontSize: '10px',
    color: '#555',
    marginTop: '6px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // Gateway
  gatewayStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px',
    border: '1px solid #222',
    borderRadius: '6px',
    marginBottom: '12px',
    fontSize: '12px',
    fontWeight: 600,
  },
  gatewayDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  gatewayGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  gwItem: {
    padding: '6px 8px',
    background: '#0c0c18',
    borderRadius: '4px',
  },
  gwLabel: {
    fontSize: '9px',
    color: '#555',
    letterSpacing: '1px',
    marginBottom: '2px',
  },
  gwValue: {
    fontSize: '11px',
    fontWeight: 500,
  },
  lastChecked: {
    fontSize: '9px',
    color: '#333',
    marginTop: '10px',
    textAlign: 'right',
  },

  // Activity Feed
  feedScroll: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 200px)',
  },
  feedItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 0',
    borderBottom: '1px solid #111',
    fontSize: '11px',
  },
  feedIcon: {
    fontSize: '12px',
    flexShrink: 0,
    marginTop: '1px',
  },
  feedAgent: {
    color: '#888',
    fontWeight: 600,
    flexShrink: 0,
    minWidth: '70px',
  },
  feedMsg: {
    color: '#aaa',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  feedTime: {
    color: '#333',
    flexShrink: 0,
    fontSize: '10px',
    marginLeft: '4px',
  },
  emptyFeed: {
    color: '#333',
    fontSize: '12px',
    padding: '20px 0',
    textAlign: 'center',
  },

  // Budget
  budgetRow: {
    marginBottom: '16px',
  },
  budgetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  budgetName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#ddd',
  },
  budgetCost: {
    fontSize: '11px',
    color: '#888',
  },
  barTrack: {
    height: '6px',
    background: '#111',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.5s ease, background-color 0.5s ease',
  },
  budgetFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9px',
    color: '#444',
  },

  // Tool Stats
  stationGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
    marginBottom: '14px',
  },
  stationCard: {
    background: '#0c0c18',
    borderRadius: '6px',
    padding: '10px',
    textAlign: 'center',
  },
  stationCount: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
  },
  stationName: {
    fontSize: '9px',
    color: '#666',
    letterSpacing: '1px',
    marginTop: '2px',
  },
  toolRecent: {},
  toolRecentHeader: {
    fontSize: '10px',
    color: '#555',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  toolRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 8px',
    borderLeft: '2px solid #00ff8840',
    marginBottom: '4px',
    fontSize: '11px',
  },
  toolIcon: {
    fontSize: '11px',
  },
  toolName: {
    color: '#aaa',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  toolDuration: {
    color: '#555',
    fontSize: '10px',
  },
  toolError: {
    color: '#ff4444',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1px',
  },

  // View toggle button
  viewToggle: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: '6px',
    color: '#00ff88',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace",
  },

  // Pixel view layout
  pixelLayout: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
  },
  pixelStrip: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },

  // Compact agent cards (pixel view)
  compactAgents: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '160px',
  },
  compactAgent: {
    background: '#0c0c18',
    border: '1px solid #1a1a2e',
    borderRadius: '6px',
    padding: '8px 10px',
    borderLeft: '3px solid #333',
  },

  // Loading
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '16px',
    padding: '80px 0',
  },
  loadingIcon: {
    fontSize: '48px',
    animation: 'pulse 2s ease-in-out infinite',
  },
  loadingText: {
    fontSize: '14px',
    color: '#888',
  },
  loadingHint: {
    fontSize: '11px',
    color: '#444',
    textAlign: 'center',
  },
  code: {
    background: '#1a1a2e',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '11px',
    color: '#00ff88',
  },
};
