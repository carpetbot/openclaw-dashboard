// config.js — Edit these to match your Pi setup
// All paths use ~ expansion handled in index.js

export default {
  // Where OpenClaw stores agent data
  openclawHome: process.env.OPENCLAW_HOME || '~/.openclaw',

  // Agent directories to watch (add more as you create agents)
  // Each entry: { id, name, directory_name }
  agents: [
    { id: 'main', name: 'Main Agent', dir: 'main' },
    // Future agents — uncomment when added:
    // { id: 'signal-feed',      name: 'SignalFeed',       dir: 'signal-feed' },
    // { id: 'market-structure',  name: 'MarketStructure',  dir: 'market-structure' },
    // { id: 'narrative-watch',   name: 'NarrativeWatch',   dir: 'narrative-watch' },
    // { id: 'reg-macro',         name: 'RegMacro',         dir: 'reg-macro' },
    // { id: 'tech-fundamentals', name: 'TechFundamentals', dir: 'tech-fundamentals' },
    // { id: 'chief-analyst',     name: 'ChiefAnalyst',     dir: 'chief-analyst' },
  ],

  // Tools that get their own "station" in the dashboard
  // All others grouped under "generic"
  featuredTools: [
    { pattern: /youtube|yt_scraper|yt-scraper/i, name: 'YouTube Scraper', icon: '📺' },
    { pattern: /perplexity|web_search|sonar/i, name: 'Web Search', icon: '🌐' },
    { pattern: /google_sheets|gsheet|spreadsheet/i, name: 'Google Sheets', icon: '📊' },
    { pattern: /telegram|tg_send|tg_post/i, name: 'Telegram', icon: '✈️' },
    { pattern: /read|write|file/i, name: 'File System', icon: '📁' },
  ],

  // Server config
  port: parseInt(process.env.BRIDGE_PORT || '3001'),
  gatewayPollInterval: 10_000, // ms — how often to check gateway health
  idleThreshold: 60_000,       // ms — agent idle after 60s of no activity

  // API budget limits (monthly) — set these to your actual limits
  // Used to calculate % remaining on budget bars
  budgetLimits: {
    'kimi-coding':  { monthlyUsd: 50,  monthlyTokens: 10_000_000 },
    'openrouter':   { monthlyUsd: 100, monthlyTokens: 5_000_000 },
    'minimax':      { monthlyUsd: 30,  monthlyTokens: 8_000_000 },
    'anthropic':    { monthlyUsd: 100, monthlyTokens: 5_000_000 },
    // Add more providers as needed
  },
};
