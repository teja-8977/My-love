import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Runs the same /api/avaturn handler as the Vercel Function during `npm run dev` (secrets from .env.local). */
function localApi(mode: string): Plugin {
  return {
    name: 'love-museum-local-api',
    configureServer(server) {
      const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
      server.middlewares.use('/api/avaturn', async (req, res) => {
        try {
          const { handleAvaturn } = (await server.ssrLoadModule('/server/avaturn.ts')) as typeof import('./server/avaturn');
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(`http://localhost${req.originalUrl ?? req.url}`, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
          const response = await handleAvaturn(request, env);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), localApi(mode)],
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
}));
