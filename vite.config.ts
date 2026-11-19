import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // VITE_* for local .env files, NEXT_PUBLIC_* for the Vercel ↔ Supabase integration.
  // (Server-only secrets such as SUPABASE_SERVICE_ROLE_KEY have neither prefix and are never exposed.)
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('@react-three') || id.includes('postprocessing')) return 'r3f';
          if (id.includes('@supabase')) return 'supabase';
        },
      },
    },
  },
});
