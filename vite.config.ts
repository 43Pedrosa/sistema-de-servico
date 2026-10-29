import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import path from 'path';
import { parse as parseDotenv } from 'dotenv';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import type { AdminRequest, AdminResponse } from './api/_admin-auth.ts';

const localServerApi: Plugin = {
  name: 'local-server-api',
  configureServer(server) {
    const envDir = server.config.envDir || process.cwd();
    const env = loadEnv(server.config.mode, envDir, '');
    const localEnvPath = path.resolve(envDir, '.env.local');
    const localEnvContents = existsSync(localEnvPath)
      ? readFileSync(localEnvPath, { encoding: 'utf8' })
      : null;
    const localEnv = localEnvContents ? parseDotenv(localEnvContents) : {};
    process.env.SUPABASE_URL ||= env.SUPABASE_URL || '';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= env.SUPABASE_SERVICE_ROLE_KEY || '';
    process.env.SUPABASE_ANON_KEY ||= env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
    process.env.VITE_SUPABASE_URL ||= env.VITE_SUPABASE_URL || '';
    process.env.VITE_SUPABASE_ANON_KEY ||= env.VITE_SUPABASE_ANON_KEY || '';
    process.env.ADMIN_USERNAME = localEnv.ADMIN_USERNAME || env.ADMIN_USERNAME || process.env.ADMIN_USERNAME || '';
    process.env.ADMIN_PASSWORD_HASH = localEnv.ADMIN_PASSWORD_HASH || env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD_HASH || '';
    process.env.ADMIN_SESSION_SECRET = localEnv.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || '';
    process.env.ADMIN_DISPLAY_NAME = localEnv.ADMIN_DISPLAY_NAME || env.ADMIN_DISPLAY_NAME || process.env.ADMIN_DISPLAY_NAME || '';

    const routes = [
      { path: '/api/approve-budget', load: () => import('./api/approve-budget.ts'), maxBytes: 16 * 1024 },
      { path: '/api/admin-login', load: () => import('./api/admin-login.ts'), maxBytes: 16 * 1024 },
      { path: '/api/admin-session', load: () => import('./api/admin-session.ts'), maxBytes: 16 * 1024 },
      { path: '/api/admin-logout', load: () => import('./api/admin-logout.ts'), maxBytes: 16 * 1024 },
      { path: '/api/admin-orders', load: () => import('./api/admin-orders.ts'), maxBytes: 4 * 1024 * 1024 },
    ];

    for (const route of routes) {
      server.middlewares.use(route.path, async (req, res) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        for await (const chunk of req) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buffer.length;
          if (totalBytes > route.maxBytes) {
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Solicitação muito grande.' }));
            return;
          }
          chunks.push(buffer);
        }

        let body: unknown;
        if (chunks.length > 0) {
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Corpo da solicitação inválido.' }));
            return;
          }
        }

        const requestUrl = new URL(req.url || '/', 'http://localhost');
        const query = Object.fromEntries(requestUrl.searchParams.entries());
        const apiRequest = {
          method: req.method,
          ip: req.socket.remoteAddress,
          headers: req.headers as AdminRequest['headers'],
          body,
          query,
        };
        const apiResponse = {
          setHeader: (name: string, value: string) => { res.setHeader(name, value); },
          status(code: number) {
            res.statusCode = code;
            return this;
          },
          json(payload: unknown) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
          },
        };

        try {
          const { default: handler } = await route.load();
          await (handler as (request: AdminRequest, response: AdminResponse) => Promise<void>)(
            apiRequest,
            apiResponse
          );
        } catch (error) {
          console.error(`Local API route ${route.path} failed`, error);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Erro interno no servidor.' }));
          }
        }
      });
    }
  },
};

export default defineConfig(() => {
  return {
    plugins: [
      localServerApi,
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon-48.png', 'apple-touch-icon.png', 'store-acessorios-logo.webp'],
        manifest: {
          id: '/',
          name: 'Store Acessórios — Ordens de Serviço',
          short_name: 'Store OS',
          description: 'Acompanhamento e gestão de Ordens de Serviço de celulares e acessórios da Store Acessórios.',
          theme_color: '#FF6500',
          background_color: '#171717',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
