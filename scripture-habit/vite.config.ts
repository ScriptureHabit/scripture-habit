/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'iOS >= 12'],
    }),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || "",
      project: process.env.SENTRY_PROJECT || "react", 
      authToken: process.env.SENTRY_AUTH_TOKEN || "",
      telemetry: false,
    }),
  ],
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  } as any,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setup-tests.ts',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/**'],
    fileParallelism: true,
    testTimeout: 5000,
    hookTimeout: 5000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    exclude: ['node_modules/', 'src/setup-tests.ts', 'tests/**']
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'firebase/analytics',
      'axios',
      'react-toastify',
      'react-router-dom',
      'zustand',
      '@sentry/react'
    ]
  },
  build: {
    sourcemap: true, // Sentryにソースマップをアップロードするために必須
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress eval warnings from vconsole
        if (warning.code === 'EVAL' && warning.id?.includes('vconsole')) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vconsole')) return 'vconsole';
            if (id.includes('@sentry')) return 'vendor-sentry';
            if (id.includes('micromark') || id.includes('mdast') || id.includes('remark') || id.includes('unist') || id.includes('hast') || id.includes('property-information')) {
              return 'vendor-markdown';
            }
            if (id.includes('@iconscout') || id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('canvas-confetti')) return 'vendor-confetti';
            if (id.includes('@firebase/storage') || id.includes('firebase/storage')) return 'vendor-firebase-storage';
            if (id.includes('@firebase/messaging') || id.includes('firebase/messaging')) return 'vendor-firebase-messaging';
            if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) return 'vendor-firebase-firestore';
            if (id.includes('@firebase/auth') || id.includes('firebase/auth')) return 'vendor-firebase-auth';
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler') || id.includes('react-router')) {
              return 'vendor-react';
            }
            return 'vendor-others';
          }
        },
      },
    },
  },
}))
