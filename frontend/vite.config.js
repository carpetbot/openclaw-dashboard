import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  define: {
    // Bridge URL — override with env var for production
    'import.meta.env.VITE_BRIDGE_URL': JSON.stringify(
      process.env.VITE_BRIDGE_URL || 'ws://localhost:3001/ws'
    ),
    'import.meta.env.VITE_BRIDGE_HTTP': JSON.stringify(
      process.env.VITE_BRIDGE_HTTP || 'http://localhost:3001'
    ),
  },
});
