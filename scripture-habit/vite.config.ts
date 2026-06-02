/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'iOS >= 12'],
    }),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || "",
      project: process.env.SENTRY_PROJECT || "react", // デフォルトでReactプロジェクト名になることが多いです
      authToken: process.env.SENTRY_AUTH_TOKEN || "",
      telemetry: false, // 匿名の利用状況データの送信をオフにします
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setup-tests.ts',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/**'],
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    exclude: ['node_modules/', 'src/setup-tests.ts', 'tests/**']
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: true, // Sentryにソースマップをアップロードするために必須
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react') || id.includes('firebase')) {
            return 'vendor';
          }
        },
      },
    },
  },
})
