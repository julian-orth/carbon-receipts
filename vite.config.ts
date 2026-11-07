/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't invalidate them.
        advancedChunks: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'charts', test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
    css: false,
    // Dummy values so `src/lib/env.ts` validates; network calls are mocked in tests.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      VITE_DEMO_EMAIL: 'demo@example.com',
      VITE_DEMO_PASSWORD: 'demo',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'supabase/functions/_shared/**/*.ts'],
      exclude: ['src/components/ui/**', 'src/types/**', 'src/test/**', 'src/main.tsx'],
    },
  },
})
